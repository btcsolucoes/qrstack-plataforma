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
            case "entering_link":
                enterStoryLink(root);
                break;
            case "positioning_link":
                positionStickerAndShare(root);
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
        AccessibilityNodeInfo link = findExactNode(root, "link");
        if (tapNodeCenter(link)) {
            advance("entering_link", "Sticker de link selecionado", 850);
            return;
        }
        AccessibilityNodeInfo search = findEditableByLabel(root, "pesquisar", "pesquisar stickers", "search", "search stickers");
        if (search == null) {
            AccessibilityNodeInfo searchButton = findNode(root, "pesquisar", "search");
            if (click(searchButton)) {
                retry("opening_stickers", 500);
                return;
            }
        } else if (setText(search, "LINK")) {
            advance("searching_link_sticker", "Pesquisa pelo sticker LINK preenchida", 800);
            return;
        }
        if (stepAttempts >= 8) fail("Sticker LINK não foi encontrado; nenhum outro sticker foi tocado");
        else retry("opening_stickers", 650);
    }

    private void selectSearchedLinkSticker(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo link = findExactNode(root, "link");
        if (tapNodeCenter(link)) {
            advance("entering_link", "Sticker LINK validado e selecionado", 850);
            return;
        }
        if (stepAttempts >= 8) fail("A pesquisa não retornou o sticker LINK; publicação interrompida com segurança");
        else retry("searching_link_sticker", 650);
    }

    private void enterStoryLink(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo editor = findEditable(root);
        if (editor == null) {
            retryOrFail("entering_link", "Campo do link não apareceu", 8);
            return;
        }
        if (!setText(editor, activeJob.storyLink)
                && !editor.performAction(AccessibilityNodeInfo.ACTION_PASTE)) {
            retryOrFail("entering_link", "Instagram recusou o preenchimento do link", 8);
            return;
        }
        AccessibilityNodeInfo done = findNode(root, "concluir", "done", "pronto", "adicionar", "add");
        if (click(done)) {
            advance("positioning_link", "Link clicável inserido", 1200);
        } else retryOrFail("entering_link", "Botão para concluir o link não apareceu", 8);
    }

    private void positionStickerAndShare(AccessibilityNodeInfo root) {
        if (stepAttempts == 1) {
            drag(0.50f, 0.50f, 0.50f, 0.72f, 650);
            scheduleStep(850);
            return;
        }
        AccessibilityNodeInfo share = findNode(root, "seu story", "your story", "compartilhar", "share", "publicar", "publish");
        if (click(share)) {
            advance("awaiting_publish_confirmation", "Comando de publicação enviado; aguardando confirmação visual", 5000);
            return;
        }
        if (stepAttempts >= 7) fail("Botão de publicar o Story não foi encontrado");
        else retry("positioning_link", 800);
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

    private AccessibilityNodeInfo findExactNode(AccessibilityNodeInfo root, String... labels) {
        if (root == null) return null;
        Set<String> expected = new HashSet<>();
        for (String label : labels) expected.add(normalize(label));
        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.removeFirst();
            String text = normalize(node.getText());
            String description = normalize(node.getContentDescription());
            boolean editable = node.isEditable() || "android.widget.EditText".contentEquals(node.getClassName());
            if (!editable && (expected.contains(text) || expected.contains(description))) return node;
            for (int index = 0; index < node.getChildCount(); index += 1) {
                AccessibilityNodeInfo child = node.getChild(index);
                if (child != null) queue.add(child);
            }
        }
        return null;
    }

    private AccessibilityNodeInfo findEditableByLabel(AccessibilityNodeInfo root, String... labels) {
        if (root == null) return null;
        Set<String> expected = new HashSet<>();
        for (String label : labels) expected.add(normalize(label));
        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.removeFirst();
            boolean editable = node.isEditable() || "android.widget.EditText".contentEquals(node.getClassName());
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

    private static boolean matchesAny(String value, Set<String> expected, boolean exact) {
        if (value.isEmpty()) return false;
        for (String label : expected) {
            if (exact ? value.equals(label) : value.contains(label)) return true;
        }
        return false;
    }

    private AccessibilityNodeInfo findEditable(AccessibilityNodeInfo root) {
        if (root == null) return null;
        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.removeFirst();
            if (node.isEditable() || "android.widget.EditText".contentEquals(node.getClassName())) return node;
            for (int index = 0; index < node.getChildCount(); index += 1) {
                AccessibilityNodeInfo child = node.getChild(index);
                if (child != null) queue.add(child);
            }
        }
        return null;
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

    private void tap(float xFraction, float yFraction) {
        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        Path path = new Path();
        path.moveTo(width * xFraction, height * yFraction);
        dispatchGesture(new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, 0, 90))
                .build(), null, null);
    }

    private void drag(float fromX, float fromY, float toX, float toY, long duration) {
        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        Path path = new Path();
        path.moveTo(width * fromX, height * fromY);
        path.lineTo(width * toX, height * toY);
        dispatchGesture(new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(path, 0, duration))
                .build(), null, null);
    }

    private static String normalize(CharSequence value) {
        return Normalizer.normalize(value == null ? "" : value.toString(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .trim();
    }
}
