package com.qrstack.agent;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.graphics.Rect;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.content.ComponentName;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.text.Normalizer;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public final class QrStackAccessibilityService extends AccessibilityService {
    private static final String INSTAGRAM = "com.instagram.android";
    private static final Set<String> TRANSIENT_PACKAGES = new HashSet<>(Arrays.asList(
            "com.android.systemui",
            "com.google.android.documentsui",
            "com.android.documentsui",
            "com.android.permissioncontroller",
            "com.samsung.android.app.sharelive",
            "com.samsung.android.honeyboard",
            "com.qrstack.agent"
    ));

    private final Handler handler = new Handler(Looper.getMainLooper());
    private AgentPreferences preferences;
    private StoryJob activeJob;
    private boolean interrupted;
    private boolean stepScheduled;
    private String lastStep = "";
    private int stepAttempts;
    private int positioningCorrections;
    private String lastLinkTapDiagnostic = "";
    private static volatile QrStackAccessibilityService instance;
    private static volatile String foregroundPackage = "";
    private static volatile long foregroundSeenAt;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        preferences = new AgentPreferences(this);
        restoreJob();
        if (preferences.shouldRun() && activeJob != null) {
            if ("awaiting_accessibility".equals(preferences.checkpoint())) AgentService.resume(this);
            else scheduleStep(900);
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (preferences == null) preferences = new AgentPreferences(this);
        String packageName = event.getPackageName() == null ? "" : event.getPackageName().toString();
        if (!packageName.isEmpty() && !TRANSIENT_PACKAGES.contains(packageName)) {
            foregroundPackage = packageName;
            foregroundSeenAt = System.currentTimeMillis();
        }
        if (!preferences.shouldRun()) {
            suspendAutomation();
            return;
        }
        restoreJob();
        if (activeJob == null) return;

        if (InterruptionGuard.isCallPackage(packageName)) {
            pauseForInterruption("Ligação tomou a tela; publicação pausada sem confirmar envio");
            return;
        }

        if (!packageName.isEmpty() && !INSTAGRAM.equals(packageName) && !TRANSIENT_PACKAGES.contains(packageName)) {
            pauseForInterruption("Outro aplicativo tomou a tela: " + packageName);
            return;
        }

        if (interrupted && INSTAGRAM.equals(packageName)) {
            handler.removeCallbacksAndMessages(null);
            handler.postDelayed(this::recoverAfterInterruption, 2400);
            return;
        }

        if (INSTAGRAM.equals(packageName)) scheduleStep(500);
    }

    @Override
    public void onInterrupt() {
        if (preferences != null && preferences.shouldRun() && activeJob != null) {
            pauseForInterruption("Serviço de acessibilidade interrompido pelo Android");
        }
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    static boolean requestInstagramStoryComposer(String mediaUri) {
        QrStackAccessibilityService service = instance;
        if (service == null || mediaUri == null || mediaUri.isEmpty()) return false;
        if (service.preferences == null) service.preferences = new AgentPreferences(service);
        if (!service.preferences.shouldRun()) return false;
        service.handler.post(() -> service.openInstagramStoryComposer(mediaUri));
        return true;
    }

    static boolean isConnected() {
        return instance != null;
    }

    static boolean isEnabled(android.content.Context context) {
        ComponentName component = new ComponentName(context, QrStackAccessibilityService.class);
        String expected = component.flattenToString();
        String enabled = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return enabled != null && enabled.contains(expected);
    }

    static boolean isInstagramForeground() {
        QrStackAccessibilityService service = instance;
        if (service != null) {
            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root != null && INSTAGRAM.contentEquals(root.getPackageName())) return true;
        }
        return INSTAGRAM.equals(foregroundPackage)
                && System.currentTimeMillis() - foregroundSeenAt < 30_000L;
    }

    private void openInstagramStoryComposer(String mediaUri) {
        Uri asset = Uri.parse(mediaUri);
        Intent intent = new Intent("com.instagram.share.ADD_TO_STORY");
        intent.setPackage(INSTAGRAM);
        intent.setDataAndType(asset, "image/png");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            grantUriPermission(INSTAGRAM, asset, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(intent);
        } catch (RuntimeException error) {
            AgentService service = AgentService.current();
            if (service != null && activeJob != null) {
                service.failForAttention(activeJob, "Instagram não está instalado ou não abriu");
            }
        }
    }

    private void restoreJob() {
        StoryJob restored = StoryJob.restore(preferences.activeJobJson());
        if (restored == null) {
            activeJob = null;
            return;
        }
        if (activeJob == null || !activeJob.id.equals(restored.id)) {
            activeJob = restored;
            lastStep = "";
            stepAttempts = 0;
            positioningCorrections = 0;
            interrupted = "paused_interruption".equals(preferences.checkpoint());
        }
    }

    private void scheduleStep(long delayMs) {
        if (stepScheduled || interrupted || activeJob == null || preferences == null || !preferences.shouldRun()) return;
        stepScheduled = true;
        handler.postDelayed(() -> {
            stepScheduled = false;
            runCurrentStep();
        }, delayMs);
    }

    private void runCurrentStep() {
        if (activeJob == null || interrupted || !preferences.shouldRun()) return;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            retry("waiting_window", 700);
            return;
        }
        String checkpoint = preferences.checkpoint();
        if (!checkpoint.equals(lastStep)) {
            lastStep = checkpoint;
            stepAttempts = 0;
        }
        stepAttempts += 1;

        switch (checkpoint) {
            case "opening_story_composer":
                openStickerTray(root);
                break;
            case "opening_stickers":
                selectLinkSticker(root);
                break;
            case "searching_link_sticker":
                selectSearchedLinkSticker(root);
                break;
            case "opening_link_editor":
                verifyLinkEditor(root);
                break;
            case "entering_link":
                enterStoryLink(root);
                break;
            case "positioning_link":
                selectPlacedLink(root);
                break;
            case "moving_link":
                movePlacedLink(root);
                break;
            case "selecting_link_for_scale":
                selectPlacedLinkForScale(root);
                break;
            case "scaling_link":
                scalePlacedLink(root);
                break;
            case "recentering_link":
                recenterPlacedLink(root);
                break;
            case "verifying_link":
                verifyPlacedLinkAndShare(root);
                break;
            case "awaiting_publish_confirmation":
                verifyPublished(root);
                break;
            case "paused_interruption":
                interrupted = true;
                break;
            case "awaiting_accessibility":
                break;
            default:
                preferences.setCheckpoint("opening_story_composer");
                scheduleStep(500);
        }
    }

    private void openStickerTray(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo sticker = findNode(root, "adesivos", "sticker", "stickers", "figurinha", "figurinhas");
        if (click(sticker)) {
            advance("opening_stickers", "Bandeja de stickers aberta", 900);
            return;
        }
        if (stepAttempts >= 4) {
            tap(0.62f, 0.08f);
            advance("opening_stickers", "Bandeja de stickers aberta por posição adaptativa", 1000);
        } else retry("opening_story_composer", 700);
    }

    private void selectLinkSticker(AccessibilityNodeInfo root) {
        if (tapVisibleLinkSticker(root)) {
            advance("opening_link_editor", "Sticker LINK tocado com validação da grade (" + lastLinkTapDiagnostic + "); aguardando campo de URL", 900);
            return;
        }
        if (stepAttempts >= 8) fail("A grade de stickers não pôde ser validada; a barra de pesquisa não foi tocada");
        else retry("opening_stickers", 650);
    }

    private void selectSearchedLinkSticker(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo link = findStickerResult(root, "link");
        if (tapNodeCenter(link)) {
            advance("opening_link_editor", "Resultado LINK validado; aguardando campo de URL", 850);
            return;
        }
        if (stepAttempts >= 8) fail("A pesquisa não retornou o sticker LINK; publicação interrompida com segurança");
        else retry("searching_link_sticker", 650);
    }

    private void verifyLinkEditor(AccessibilityNodeInfo root) {
        if (isWrongStickerEditorScreen(root)) {
            performGlobalAction(GLOBAL_ACTION_BACK);
            fail("O Instagram abriu outro sticker em vez do LINK; operação parada antes de colar qualquer texto");
            return;
        }
        AccessibilityNodeInfo editor = findLinkEditor(root);
        if (editor != null) {
            advance("entering_link", "Campo de URL do sticker confirmado", 250);
            return;
        }
        if (stepAttempts >= 7) {
            fail("O sticker LINK não abriu o campo de URL; nenhum texto foi colado na busca de stickers");
        } else retry("opening_link_editor", 650);
    }

    private void enterStoryLink(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo editor = findLinkEditor(root);
        if (editor == null) {
            retryOrFail("entering_link", "Campo de URL seguro não apareceu; a busca de stickers foi ignorada", 8);
            return;
        }
        if (!setText(editor, activeJob.storyLink)
                && !editor.performAction(AccessibilityNodeInfo.ACTION_PASTE)) {
            retryOrFail("entering_link", "Instagram recusou o preenchimento do link", 8);
            return;
        }
        if (tapDoneInLinkEditor(root)) {
            positioningCorrections = 0;
            advance("positioning_link", "Link clicável inserido; preparando posição e tamanho do sticker", 1400);
        } else retryOrFail("entering_link", "Botão para concluir o link não apareceu", 8);
    }

    private void selectPlacedLink(AccessibilityNodeInfo root) {
        if (findLinkEditor(root) != null) {
            retryOrFail("positioning_link", "O editor do link não fechou depois de tocar em Done", 6);
            return;
        }
        if (findStoryShareAction(root) == null) {
            retryOrFail("positioning_link", "O editor do Story não reapareceu depois de concluir o link", 8);
            return;
        }
        AccessibilityNodeInfo sticker = findPlacedLinkSticker(root);
        boolean dispatched = sticker != null ? tapNodeCenter(sticker) : tap(0.50f, storyCenterYFraction());
        if (dispatched) {
            advance("moving_link", "Sticker LINK selecionado para posicionamento", 450);
        } else retryOrFail("positioning_link", "O sticker LINK não respondeu ao toque de seleção", 6);
    }

    private void movePlacedLink(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo sticker = findPlacedLinkSticker(root);
        Rect bounds = new Rect();
        if (sticker != null) sticker.getBoundsInScreen(bounds);
        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        float fromX = bounds.isEmpty() ? 0.50f : bounds.exactCenterX() / width;
        float fromY = bounds.isEmpty() ? storyCenterYFraction() : bounds.exactCenterY() / height;
        if (drag(fromX, fromY, 0.50f, storyStickerTargetYFraction(), 1450)) {
            advance("selecting_link_for_scale", "Sticker movido para o centro da área pontilhada", 1650);
        } else retryOrFail("moving_link", "O Android recusou o gesto de mover o sticker", 5);
    }

    private void selectPlacedLinkForScale(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo sticker = findPlacedLinkSticker(root);
        boolean dispatched = sticker != null ? tapNodeCenter(sticker) : tap(0.50f, storyStickerTargetYFraction());
        if (dispatched) {
            advance("scaling_link", "Sticker selecionado para ampliação", 420);
        } else retryOrFail("selecting_link_for_scale", "O sticker não respondeu antes da ampliação", 5);
    }

    private void scalePlacedLink(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo sticker = findPlacedLinkSticker(root);
        Rect bounds = new Rect();
        if (sticker != null) sticker.getBoundsInScreen(bounds);
        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        float centerX = bounds.isEmpty() ? 0.50f : bounds.exactCenterX() / width;
        float centerY = bounds.isEmpty() ? storyStickerTargetYFraction() : bounds.exactCenterY() / height;
        if (pinchOutHorizontal(centerX, centerY, 0.075f, 0.145f, 1050)) {
            advance("recentering_link", "Sticker LINK ampliado", 1350);
        } else retryOrFail("scaling_link", "O Android recusou o gesto de ampliar o sticker", 5);
    }

    private void recenterPlacedLink(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo sticker = findPlacedLinkSticker(root);
        Rect bounds = new Rect();
        if (sticker != null) sticker.getBoundsInScreen(bounds);
        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        float fromX = bounds.isEmpty() ? 0.50f : bounds.exactCenterX() / width;
        float fromY = bounds.isEmpty() ? storyStickerTargetYFraction() : bounds.exactCenterY() / height;
        if (drag(fromX, fromY, 0.50f, storyStickerTargetYFraction(), 900)) {
            advance("verifying_link", "Sticker recentralizado após a ampliação", 1150);
        } else retryOrFail("recentering_link", "O Android recusou o ajuste final do sticker", 5);
    }

    private void verifyPlacedLinkAndShare(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo positioned = findPlacedLinkSticker(root);
        if (positioned != null) {
            Rect bounds = new Rect();
            positioned.getBoundsInScreen(bounds);
            int width = getResources().getDisplayMetrics().widthPixels;
            int height = getResources().getDisplayMetrics().heightPixels;
            float targetY = storyStickerTargetYFraction();
            boolean centered = Math.abs(bounds.exactCenterX() - width * 0.50f) <= width * 0.055f
                    && Math.abs(bounds.exactCenterY() - height * targetY) <= height * 0.045f;
            if (!centered && positioningCorrections < 2) {
                positioningCorrections += 1;
                advance("moving_link", "Sticker fora do centro; repetindo o ajuste de posição", 350);
                return;
            }
            if (!centered) {
                fail("O sticker LINK continuou fora da área pontilhada; publicação interrompida para não postar errado");
                return;
            }
            boolean largeEnough = bounds.width() >= width * 0.46f;
            if (!largeEnough && positioningCorrections < 2) {
                positioningCorrections += 1;
                advance("selecting_link_for_scale", "Sticker ainda pequeno; repetindo a ampliação", 350);
                return;
            }
            if (!largeEnough) {
                fail("O sticker LINK continuou pequeno; publicação interrompida para não postar errado");
                return;
            }
        }
        AccessibilityNodeInfo share = findStoryShareAction(root);
        if (click(share)) {
            advance("awaiting_publish_confirmation", "Link posicionado na área reservada e comando de publicação enviado", 5000);
            return;
        }
        if (stepAttempts >= 7) fail("Botão de publicar o Story não foi encontrado");
        else retry("verifying_link", 800);
    }

    private AccessibilityNodeInfo findStoryShareAction(AccessibilityNodeInfo root) {
        return findNode(root, "seu story", "your story", "compartilhar", "share", "publicar", "publish");
    }

    private float storyCenterYFraction() {
        return storyCanvasYFraction(0.50f);
    }

    private float storyStickerTargetYFraction() {
        // The dashed box is centered at y=1390 in the 1080x1920 story artwork.
        return storyCanvasYFraction(1390f / 1920f);
    }

    private float storyCanvasYFraction(float canvasYFraction) {
        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        // Instagram anchors a 9:16 Story canvas to the top of the editor and
        // reserves the remaining lower screen area for its sharing controls.
        float storyHeight = Math.min(height, width * (16f / 9f));
        return storyHeight * canvasYFraction / height;
    }

    private void verifyPublished(AccessibilityNodeInfo root) {
        boolean explicit = findNode(root, "compartilhado", "shared", "story publicado", "publicado no seu story") != null;
        boolean home = findNode(root, "pagina inicial", "home", "pesquisar", "search", "reels") != null
                && findNode(root, "seu story", "your story") != null;
        if (explicit || home) {
            AgentService service = AgentService.current();
            if (service != null) service.complete(activeJob);
            activeJob = null;
            interrupted = false;
            return;
        }
        if (stepAttempts >= 10) fail("O Instagram não confirmou visualmente a publicação; nenhuma segunda tentativa automática foi feita");
        else retry("awaiting_publish_confirmation", 1200);
    }

    private void pauseForInterruption(String detail) {
        if (interrupted || activeJob == null) return;
        interrupted = true;
        handler.removeCallbacksAndMessages(null);
        preferences.setCheckpoint("paused_interruption");
        AgentService service = AgentService.current();
        if (service != null) service.pauseForInterruption(activeJob, detail);
    }

    private void recoverAfterInterruption() {
        if (activeJob == null || !preferences.shouldRun()) return;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if ("awaiting_publish_confirmation".equals(lastStep) && root != null) {
            interrupted = false;
            preferences.setCheckpoint("awaiting_publish_confirmation");
            scheduleStep(900);
            return;
        }
        int attempts = preferences.incrementRecoveryAttempts();
        if (attempts > 4) {
            fail("Muitas interrupções consecutivas; publicação mantida para conferência manual");
            return;
        }
        interrupted = false;
        preferences.setCheckpoint("resuming_after_interruption");
        AgentService.resume(this);
    }

    private void suspendAutomation() {
        handler.removeCallbacksAndMessages(null);
        stepScheduled = false;
        interrupted = true;
        activeJob = null;
    }

    private void advance(String checkpoint, String detail, long nextDelay) {
        preferences.setCheckpoint(checkpoint);
        stepAttempts = 0;
        lastStep = checkpoint;
        AgentService service = AgentService.current();
        if (service != null) service.checkpoint(activeJob, checkpoint, detail);
        scheduleStep(nextDelay);
    }

    private void retry(String checkpoint, long delay) {
        if (stepAttempts > 12) {
            fail("A interface do Instagram não respondeu na etapa " + checkpoint);
            return;
        }
        scheduleStep(delay);
    }

    private void retryOrFail(String checkpoint, String message, int maxAttempts) {
        if (stepAttempts >= maxAttempts) fail(message);
        else retry(checkpoint, 700);
    }

    private void fail(String detail) {
        handler.removeCallbacksAndMessages(null);
        AgentService service = AgentService.current();
        if (service != null) service.failForAttention(activeJob, detail);
        interrupted = true;
    }

    private AccessibilityNodeInfo findNode(AccessibilityNodeInfo root, String... labels) {
        if (root == null) return null;
        Set<String> expected = new HashSet<>();
        for (String label : labels) expected.add(normalize(label));
        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.removeFirst();
            String text = normalize(node.getText());
            String description = normalize(node.getContentDescription());
            for (String label : expected) {
                if ((!text.isEmpty() && text.contains(label)) || (!description.isEmpty() && description.contains(label))) return node;
            }
            for (int index = 0; index < node.getChildCount(); index += 1) {
                AccessibilityNodeInfo child = node.getChild(index);
                if (child != null) queue.add(child);
            }
        }
        return null;
    }

    private AccessibilityNodeInfo findPlacedLinkSticker(AccessibilityNodeInfo root) {
        if (root == null || activeJob == null) return null;
        String fullLink = normalize(activeJob.storyLink);
        String compactLink = fullLink.replace("https://", "").replace("http://", "").replace("www.", "");
        AccessibilityNodeInfo best = null;
        int bestArea = Integer.MAX_VALUE;
        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.removeFirst();
            String text = normalize(node.getText());
            String description = normalize(node.getContentDescription());
            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            boolean matchesLink = (!compactLink.isEmpty() && (text.contains(compactLink) || description.contains(compactLink)))
                    || (!fullLink.isEmpty() && (text.contains(fullLink) || description.contains(fullLink)));
            if (matchesLink && !bounds.isEmpty() && !hasEditableAncestor(node)) {
                int area = bounds.width() * bounds.height();
                if (area < bestArea) {
                    best = node;
                    bestArea = area;
                }
            }
            for (int index = 0; index < node.getChildCount(); index += 1) {
                AccessibilityNodeInfo child = node.getChild(index);
                if (child != null) queue.add(child);
            }
        }
        return best;
    }

    private AccessibilityNodeInfo findStickerResult(AccessibilityNodeInfo root, String label) {
        if (root == null) return null;
        String expected = normalizeWords(label);
        AccessibilityNodeInfo search = findStickerSearchEditor(root);
        Rect searchBounds = new Rect();
        if (search != null) search.getBoundsInScreen(searchBounds);
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        AccessibilityNodeInfo best = null;
        int bestScore = Integer.MIN_VALUE;

        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.removeFirst();
            String text = normalize(node.getText());
            String description = normalize(node.getContentDescription());
            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            String textWords = normalizeWords(text);
            String descriptionWords = normalizeWords(description);
            boolean exactLabel = expected.equals(textWords) || expected.equals(descriptionWords);
            boolean wordLabel = containsWord(textWords, expected) || containsWord(descriptionWords, expected);
            boolean belowSearch = search == null || searchBounds.isEmpty() || bounds.top >= searchBounds.bottom;
            boolean stickerSized = bounds.width() > 24 && bounds.height() > 20
                    && bounds.width() < screenWidth * 0.65f
                    && bounds.height() < screenHeight * 0.22f;
            if (wordLabel && stickerSized && belowSearch && !hasEditableAncestor(node)) {
                int score = exactLabel ? 1000 : 500;
                if (node.isClickable()) score += 120;
                if (node.getChildCount() == 0) score += 80;
                score -= Math.min(300, (bounds.width() * bounds.height()) / 1000);
                if (score > bestScore) {
                    best = node;
                    bestScore = score;
                }
            }
            for (int index = 0; index < node.getChildCount(); index += 1) {
                AccessibilityNodeInfo child = node.getChild(index);
                if (child != null) queue.add(child);
            }
        }
        return best;
    }

    private AccessibilityNodeInfo findStickerSearchEditor(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo search = findEditableByLabel(root,
                "pesquisar", "pesquisar stickers", "pesquisar figurinhas",
                "search", "search stickers", "search gifs and stickers");
        if (search != null) return search;

        if (findNode(root, "stickers", "figurinhas", "adesivos") == null) return null;
        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.removeFirst();
            if (isEditable(node) && "link".equals(normalize(node.getText()))) return node;
            for (int index = 0; index < node.getChildCount(); index += 1) {
                AccessibilityNodeInfo child = node.getChild(index);
                if (child != null) queue.add(child);
            }
        }
        return null;
    }

    private AccessibilityNodeInfo findLinkEditor(AccessibilityNodeInfo root) {
        if (root == null || !isConfirmedLinkEditorScreen(root) || isWrongStickerEditorScreen(root)) return null;
        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.removeFirst();
            if (isEditable(node) && !isStickerSearchField(node)) return node;
            for (int index = 0; index < node.getChildCount(); index += 1) {
                AccessibilityNodeInfo child = node.getChild(index);
                if (child != null) queue.add(child);
            }
        }
        return null;
    }

    private boolean tapDoneInLinkEditor(AccessibilityNodeInfo root) {
        if (root == null || findLinkEditor(root) == null) return false;
        AccessibilityNodeInfo done = findTopRightAction(root, "done", "concluir", "pronto");
        if (tapNodeCenter(done)) return true;

        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        return tapAbsolute(width * 0.905f, height * 0.263f);
    }

    private AccessibilityNodeInfo findTopRightAction(AccessibilityNodeInfo root, String... labels) {
        if (root == null) return null;
        Set<String> expected = new HashSet<>();
        for (String label : labels) expected.add(normalize(label));
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        AccessibilityNodeInfo best = null;
        int bestScore = Integer.MIN_VALUE;

        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.removeFirst();
            String text = normalizeWords(node.getText());
            String description = normalizeWords(node.getContentDescription());
            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            boolean labelMatches = matchesAny(text, expected, true) || matchesAny(description, expected, true);
            boolean topRight = !bounds.isEmpty()
                    && bounds.exactCenterX() >= screenWidth * 0.68f
                    && bounds.exactCenterY() <= screenHeight * 0.36f;
            if (labelMatches && topRight) {
                int score = (int) bounds.exactCenterX() - Math.abs((int) bounds.exactCenterY() - (int) (screenHeight * 0.265f));
                if (node.isClickable()) score += 400;
                if (score > bestScore) {
                    best = node;
                    bestScore = score;
                }
            }
            for (int index = 0; index < node.getChildCount(); index += 1) {
                AccessibilityNodeInfo child = node.getChild(index);
                if (child != null) queue.add(child);
            }
        }
        return best;
    }

    private boolean isConfirmedLinkEditorScreen(AccessibilityNodeInfo root) {
        return findNode(root,
                "adicionar link", "adicione um link", "inserir link", "link externo",
                "url", "endereco da web", "personalizar texto do sticker",
                "add link", "insert link", "enter url", "web address", "customize sticker text") != null;
    }

    private boolean isWrongStickerEditorScreen(AccessibilityNodeInfo root) {
        return findNode(root,
                "contagem regressiva", "nome da contagem", "data de termino", "countdown",
                "localizacao", "location", "mencao", "mention", "musica", "music",
                "perguntas", "questions", "enquete", "poll") != null;
    }

    private boolean tapVisibleLinkSticker(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo search = findStickerSearchEditor(root);
        if (search == null) return false;
        Rect searchBounds = new Rect();
        search.getBoundsInScreen(searchBounds);
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        boolean validSearchBar = !searchBounds.isEmpty()
                && searchBounds.width() >= screenWidth * 0.70f
                && searchBounds.top >= screenHeight * 0.15f
                && searchBounds.bottom <= screenHeight * 0.42f;
        if (!validSearchBar) return false;

        AccessibilityNodeInfo exposedLink = findStickerResult(root, "link");
        Rect linkBounds = new Rect();
        if (exposedLink != null) exposedLink.getBoundsInScreen(linkBounds);
        boolean exposedLooksSafe = !linkBounds.isEmpty()
                && linkBounds.top > searchBounds.bottom
                && linkBounds.bottom < screenHeight * 0.78f
                && linkBounds.left < screenWidth * 0.55f
                && linkBounds.width() < screenWidth * 0.35f
                && linkBounds.height() < screenHeight * 0.09f;
        if (exposedLooksSafe && tapNodeCenter(exposedLink)) {
            lastLinkTapDiagnostic = "node x=" + Math.round(linkBounds.exactCenterX())
                    + " y=" + Math.round(linkBounds.exactCenterY());
            return true;
        }

        // Instagram 2026 exposes two sticker-grid layouts. English keeps LINK in the
        // first column; Portuguese can shift it to the second visual column.
        boolean englishGrid = isEnglishStickerTray(root, search);
        float targetX = searchBounds.left + searchBounds.width() * (englishGrid ? 0.165f : 0.345f);
        float targetY = searchBounds.top + screenWidth * 0.846f;
        if (targetX <= 0 || targetX >= screenWidth || targetY <= searchBounds.bottom || targetY >= screenHeight * 0.82f) {
            return false;
        }
        lastLinkTapDiagnostic = (englishGrid ? "english-grid" : "pt-grid")
                + " x=" + Math.round(targetX)
                + " y=" + Math.round(targetY)
                + " search=" + searchBounds.left + "," + searchBounds.top + "," + searchBounds.right + "," + searchBounds.bottom;
        return tapAbsolute(targetX, targetY);
    }

    private boolean isEnglishStickerTray(AccessibilityNodeInfo root, AccessibilityNodeInfo search) {
        String searchText = normalize(search.getText()) + " "
                + normalize(search.getContentDescription()) + " "
                + normalize(search.getHintText());
        if (containsWord(normalizeWords(searchText), "search")) return true;
        return findNode(root, "location", "mention", "add yours", "frames", "cutouts", "notify", "poll", "countdown") != null
                && findNode(root, "localizacao", "mencao", "sua vez", "quadros", "recortes", "enquete", "contagem regressiva") == null;
    }

    private boolean isStickerSearchField(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo current = node;
        for (int depth = 0; current != null && depth < 7; depth += 1) {
            String combined = normalize(current.getText()) + " "
                    + normalize(current.getContentDescription()) + " "
                    + normalize(current.getHintText());
            if (combined.contains("pesquisar") || combined.contains("pesquisa")
                    || combined.contains("search") || combined.contains("sticker")
                    || combined.contains("figurinha") || combined.contains("adesivo")) return true;
            current = current.getParent();
        }
        return false;
    }

    private boolean hasEditableAncestor(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo current = node;
        for (int depth = 0; current != null && depth < 8; depth += 1) {
            if (isEditable(current) || isStickerSearchField(current)) return true;
            current = current.getParent();
        }
        return false;
    }

    private static boolean isEditable(AccessibilityNodeInfo node) {
        return node != null && (node.isEditable() || "android.widget.EditText".contentEquals(node.getClassName()));
    }

    private static String normalizeWords(CharSequence value) {
        return normalize(value).replaceAll("[^a-z0-9]+", " ").trim();
    }

    private static boolean containsWord(String value, String expected) {
        if (value.isEmpty() || expected.isEmpty()) return false;
        return (" " + value + " ").contains(" " + expected + " ");
    }

    private AccessibilityNodeInfo findEditableByLabel(AccessibilityNodeInfo root, String... labels) {
        if (root == null) return null;
        Set<String> expected = new HashSet<>();
        for (String label : labels) expected.add(normalize(label));
        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.removeFirst();
            boolean editable = isEditable(node);
            String text = normalize(node.getText());
            String description = normalize(node.getContentDescription());
            String hint = normalize(node.getHintText());
            if (editable && (matchesAny(text, expected, false)
                    || matchesAny(description, expected, false)
                    || matchesAny(hint, expected, false))) return node;
            for (int index = 0; index < node.getChildCount(); index += 1) {
                AccessibilityNodeInfo child = node.getChild(index);
                if (child != null) queue.add(child);
            }
        }
        return null;
    }

    private boolean setText(AccessibilityNodeInfo node, String value) {
        if (node == null) return false;
        Bundle text = new Bundle();
        text.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value);
        node.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
        return node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, text);
    }

    private boolean tapNodeCenter(AccessibilityNodeInfo node) {
        if (node == null) return false;
        Rect bounds = new Rect();
        node.getBoundsInScreen(bounds);
        if (bounds.isEmpty()) return false;
        Path path = new Path();
        path.moveTo(bounds.exactCenterX(), bounds.exactCenterY());
        return dispatchGesture(new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, 0, 90))
                .build(), null, null);
    }

    private boolean tapAbsolute(float x, float y) {
        Path path = new Path();
        path.moveTo(x, y);
        return dispatchGesture(new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, 0, 110))
                .build(), null, null);
    }

    private static boolean matchesAny(String value, Set<String> expected, boolean exact) {
        if (value.isEmpty()) return false;
        for (String label : expected) {
            if (exact ? value.equals(label) : value.contains(label)) return true;
        }
        return false;
    }

    private AccessibilityNodeInfo firstGalleryImage(AccessibilityNodeInfo root) {
        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.removeFirst();
            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            boolean image = "android.widget.ImageView".contentEquals(node.getClassName()) || normalize(node.getContentDescription()).contains("foto");
            if (image && bounds.width() > 110 && bounds.height() > 110 && bounds.top > 100 && node.isClickable()) return node;
            for (int index = 0; index < node.getChildCount(); index += 1) {
                AccessibilityNodeInfo child = node.getChild(index);
                if (child != null) queue.add(child);
            }
        }
        return null;
    }

    private boolean click(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo clickable = clickableParent(node);
        if (clickable == null) return false;
        clickable.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SHOW_ON_SCREEN.getId());
        return clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK);
    }

    private AccessibilityNodeInfo clickableParent(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo current = node;
        for (int depth = 0; current != null && depth < 6; depth += 1) {
            if (current.isClickable()) return current;
            current = current.getParent();
        }
        return null;
    }

    private boolean tap(float xFraction, float yFraction) {
        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        Path path = new Path();
        path.moveTo(width * xFraction, height * yFraction);
        return dispatchGesture(new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, 0, 90))
                .build(), null, null);
    }

    private boolean drag(float fromX, float fromY, float toX, float toY, long duration) {
        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        Path path = new Path();
        path.moveTo(width * fromX, height * fromY);
        path.lineTo(width * toX, height * toY);
        return dispatchGesture(new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, 0, duration))
                .build(), null, null);
    }

    private boolean pinchOutHorizontal(float centerX, float centerY, float startRadius, float endRadius, long duration) {
        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        float centerPx = width * centerX;
        float centerPy = height * centerY;
        float startX = width * startRadius;
        float endX = width * endRadius;

        Path first = new Path();
        first.moveTo(centerPx - startX, centerPy);
        first.lineTo(centerPx - endX, centerPy);

        Path second = new Path();
        second.moveTo(centerPx + startX, centerPy);
        second.lineTo(centerPx + endX, centerPy);

        return dispatchGesture(new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(first, 0, duration))
                .addStroke(new GestureDescription.StrokeDescription(second, 0, duration))
                .build(), null, null);
    }

    private static String normalize(CharSequence value) {
        return Normalizer.normalize(value == null ? "" : value.toString(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .trim();
    }
}
