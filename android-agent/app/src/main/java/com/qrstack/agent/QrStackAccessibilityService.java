package com.qrstack.agent;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Bitmap;
import android.graphics.Path;
import android.graphics.Rect;
import android.hardware.HardwareBuffer;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.content.ComponentName;
import android.view.Display;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.text.Normalizer;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public final class QrStackAccessibilityService extends AccessibilityService {
    private static final String INSTAGRAM = "com.instagram.android";
    private static final String[] LINK_ICON_TEMPLATE = {
            ".................",
            ".........##......",
            ".......######....",
            "......###..###...",
            "......##.....##..",
            ".............##..",
            ".........##..##..",
            "...##...##...#...",
            "..##...##...##...",
            "..#...##....#....",
            "..##..#..........",
            "..##.....#.......",
            "...##...##.......",
            "...######........",
            "......#..........",
            ".................",
            "................."
    };
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
    private TextRecognizer textRecognizer;
    private boolean visualScanInFlight;
    private static volatile QrStackAccessibilityService instance;
    private static volatile String foregroundPackage = "";
    private static volatile long foregroundSeenAt;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        preferences = new AgentPreferences(this);
        textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
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
        if (textRecognizer != null) textRecognizer.close();
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
                selectLinkSticker(root);
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
        // A arvore do Instagram atribui "link" a containers com limites incorretos.
        // O clique so e liberado depois da confirmacao visual do sticker real.
        findAndTapLinkStickerVisually(root);
    }

    private void findAndTapLinkStickerVisually(AccessibilityNodeInfo root) {
        if (visualScanInFlight) return;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            fail("O Android deste aparelho não permite localizar visualmente o sticker LINK");
            return;
        }
        Rect searchBounds = new Rect();
        AccessibilityNodeInfo search = findStickerSearchEditor(root);
        if (search != null) search.getBoundsInScreen(searchBounds);
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        int minY = searchBounds.isEmpty() ? Math.round(screenHeight * 0.18f) : searchBounds.bottom;
        int maxY = Math.round(screenHeight * 0.90f);
        visualScanInFlight = true;
        takeScreenshot(Display.DEFAULT_DISPLAY, getMainExecutor(), new TakeScreenshotCallback() {
            @Override
            public void onSuccess(ScreenshotResult screenshot) {
                Bitmap bitmap = copyScreenshotBitmap(screenshot);
                if (bitmap == null) {
                    finishVisualScanFailure("A captura da grade de stickers veio vazia");
                    return;
                }
                TextRecognizer recognizer = textRecognizer;
                if (recognizer == null) {
                    bitmap.recycle();
                    finishVisualScanFailure("O leitor visual do sticker LINK não iniciou");
                    return;
                }
                recognizer.process(InputImage.fromBitmap(bitmap, 0))
                        .addOnSuccessListener(getMainExecutor(), visionText -> {
                            Rect linkBounds = findVisualLinkBounds(visionText, minY, maxY, screenWidth, screenHeight);
                            String visualMethod = "ocr";
                            if (linkBounds == null) {
                                linkBounds = findVisualLinkIconBounds(bitmap, minY, maxY);
                                visualMethod = "icone-corrente";
                            }
                            bitmap.recycle();
                            visualScanInFlight = false;
                            if (!isCurrentCheckpoint("opening_stickers", "searching_link_sticker")) return;
                            if (linkBounds != null && tapAbsolute(linkBounds.exactCenterX(), linkBounds.exactCenterY())) {
                                lastLinkTapDiagnostic = "visual-" + visualMethod + " x=" + Math.round(linkBounds.exactCenterX())
                                        + " y=" + Math.round(linkBounds.exactCenterY());
                                advance("opening_link_editor", "Sticker LINK localizado visualmente (" + lastLinkTapDiagnostic + ")", 900);
                            } else finishVisualScanFailure("O leitor visual não encontrou o texto nem o ícone de corrente do sticker LINK");
                        })
                        .addOnFailureListener(getMainExecutor(), error -> {
                            bitmap.recycle();
                            finishVisualScanFailure("Falha ao ler visualmente a grade de stickers");
                        });
            }

            @Override
            public void onFailure(int errorCode) {
                finishVisualScanFailure("O Android recusou a captura da grade de stickers (" + errorCode + ")");
            }
        });
    }

    @android.annotation.TargetApi(Build.VERSION_CODES.R)
    private Bitmap copyScreenshotBitmap(ScreenshotResult screenshot) {
        HardwareBuffer buffer = screenshot.getHardwareBuffer();
        try {
            Bitmap hardwareBitmap = Bitmap.wrapHardwareBuffer(buffer, screenshot.getColorSpace());
            return hardwareBitmap == null ? null : hardwareBitmap.copy(Bitmap.Config.ARGB_8888, false);
        } finally {
            buffer.close();
        }
    }

    private Rect findVisualLinkBounds(Text visionText, int minY, int maxY, int screenWidth, int screenHeight) {
        Rect best = null;
        int bestScore = Integer.MIN_VALUE;
        for (Text.TextBlock block : visionText.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                for (Text.Element element : line.getElements()) {
                    if (!isVisualLinkWord(element.getText())) continue;
                    Rect bounds = element.getBoundingBox();
                    if (bounds == null || bounds.isEmpty()) continue;
                    boolean insideTray = bounds.top >= minY && bounds.bottom <= maxY;
                    boolean plausibleSize = bounds.width() >= screenWidth * 0.06f
                            && bounds.width() <= screenWidth * 0.42f
                            && bounds.height() >= screenHeight * 0.012f
                            && bounds.height() <= screenHeight * 0.10f;
                    if (!insideTray || !plausibleSize) continue;
                    int score = 2000 - bounds.top;
                    float ratio = bounds.width() / (float) Math.max(1, bounds.height());
                    if (ratio >= 1.2f && ratio <= 6f) score += 500;
                    if (score > bestScore) {
                        best = new Rect(bounds);
                        bestScore = score;
                    }
                }
            }
        }
        return best;
    }

    private boolean isVisualLinkWord(String value) {
        String word = normalizeWords(value)
                .replace('1', 'i')
                .replace('l', 'i');
        if ("iink".equals(word) || "ink".equals(word) || "lnk".equals(word)) return true;
        return editDistanceAtMostOne(word, "iink");
    }

    private boolean editDistanceAtMostOne(String left, String right) {
        if (left == null || right == null || Math.abs(left.length() - right.length()) > 1) return false;
        int row = 0;
        int column = 0;
        int differences = 0;
        while (row < left.length() && column < right.length()) {
            if (left.charAt(row) == right.charAt(column)) {
                row += 1;
                column += 1;
                continue;
            }
            differences += 1;
            if (differences > 1) return false;
            if (left.length() > right.length()) row += 1;
            else if (right.length() > left.length()) column += 1;
            else {
                row += 1;
                column += 1;
            }
        }
        if (row < left.length() || column < right.length()) differences += 1;
        return differences <= 1;
    }

    private Rect findVisualLinkIconBounds(Bitmap bitmap, int minY, int maxY) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int top = Math.max(0, Math.min(height - 1, minY));
        int bottom = Math.max(top + 1, Math.min(height, maxY));
        int[] pixels = new int[width * height];
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height);

        int regionHeight = bottom - top;
        byte[] blueMask = new byte[width * regionHeight];
        for (int y = top; y < bottom; y += 1) {
            int rowOffset = y * width;
            int maskOffset = (y - top) * width;
            for (int x = 0; x < width; x += 1) {
                if (isInstagramLinkBlue(pixels[rowOffset + x])) blueMask[maskOffset + x] = 1;
            }
        }

        Rect best = null;
        float bestScore = 0f;
        ArrayDeque<Integer> queue = new ArrayDeque<>();
        int minComponentWidth = Math.max(7, Math.round(width * 0.012f));
        int maxComponentWidth = Math.round(width * 0.10f);
        int minComponentHeight = Math.max(9, Math.round(height * 0.008f));
        int maxComponentHeight = Math.round(height * 0.07f);

        for (int maskY = 0; maskY < regionHeight; maskY += 1) {
            for (int x = 0; x < width; x += 1) {
                int start = maskY * width + x;
                if (blueMask[start] != 1) continue;
                blueMask[start] = 2;
                queue.add(start);
                int left = x;
                int right = x;
                int componentTop = maskY;
                int componentBottom = maskY;
                int area = 0;

                while (!queue.isEmpty()) {
                    int current = queue.removeFirst();
                    int currentY = current / width;
                    int currentX = current - currentY * width;
                    area += 1;
                    left = Math.min(left, currentX);
                    right = Math.max(right, currentX);
                    componentTop = Math.min(componentTop, currentY);
                    componentBottom = Math.max(componentBottom, currentY);
                    for (int offsetY = -1; offsetY <= 1; offsetY += 1) {
                        int nextY = currentY + offsetY;
                        if (nextY < 0 || nextY >= regionHeight) continue;
                        for (int offsetX = -1; offsetX <= 1; offsetX += 1) {
                            if (offsetX == 0 && offsetY == 0) continue;
                            int nextX = currentX + offsetX;
                            if (nextX < 0 || nextX >= width) continue;
                            int next = nextY * width + nextX;
                            if (blueMask[next] != 1) continue;
                            blueMask[next] = 2;
                            queue.add(next);
                        }
                    }
                }

                int componentWidth = right - left + 1;
                int componentHeight = componentBottom - componentTop + 1;
                if (area < 24
                        || componentWidth < minComponentWidth || componentWidth > maxComponentWidth
                        || componentHeight < minComponentHeight || componentHeight > maxComponentHeight) continue;

                Rect component = new Rect(left, componentTop + top, right + 1, componentBottom + top + 1);
                float templateScore = scoreLinkIconTemplate(pixels, width, height, component);
                float pillScore = scoreWhiteStickerPill(pixels, width, height, component);
                float score = templateScore * 0.86f + pillScore * 0.14f;
                if (templateScore >= 0.52f && pillScore >= 0.38f && score > bestScore) {
                    best = linkStickerTapBounds(component, width, height);
                    bestScore = score;
                }
            }
        }
        return best;
    }

    private boolean isInstagramLinkBlue(int color) {
        int red = (color >> 16) & 0xff;
        int green = (color >> 8) & 0xff;
        int blue = color & 0xff;
        return blue >= 120
                && blue - red >= 28
                && blue - green >= 7
                && green >= red - 12;
    }

    private float scoreLinkIconTemplate(int[] pixels, int width, int height, Rect component) {
        int padX = Math.max(3, Math.round(component.width() * 0.17f));
        int padY = Math.max(3, Math.round(component.height() * 0.17f));
        Rect sample = new Rect(
                Math.max(0, component.left - padX),
                Math.max(0, component.top - padY),
                Math.min(width, component.right + padX),
                Math.min(height, component.bottom + padY)
        );
        int intersection = 0;
        int union = 0;
        int size = LINK_ICON_TEMPLATE.length;
        for (int row = 0; row < size; row += 1) {
            for (int column = 0; column < size; column += 1) {
                int x = Math.min(width - 1,
                        sample.left + Math.round((column + 0.5f) * sample.width() / size));
                int y = Math.min(height - 1,
                        sample.top + Math.round((row + 0.5f) * sample.height() / size));
                boolean expected = LINK_ICON_TEMPLATE[row].charAt(column) == '#';
                boolean actual = isInstagramLinkBlue(pixels[y * width + x]);
                if (expected && actual) intersection += 1;
                if (expected || actual) union += 1;
            }
        }
        return intersection / (float) Math.max(1, union);
    }

    private float scoreWhiteStickerPill(int[] pixels, int width, int height, Rect component) {
        int pillTop = Math.max(0, component.top - Math.round(component.height() * 0.45f));
        int pillBottom = Math.min(height, component.bottom + Math.round(component.height() * 0.45f));
        int pillLeft = Math.max(0, component.left - Math.round(component.width() * 0.60f));
        int pillRight = Math.min(width, component.right + Math.round(width * 0.14f));
        int white = 0;
        int sampled = 0;
        int stride = Math.max(1, width / 720);
        for (int y = pillTop; y < pillBottom; y += stride) {
            for (int x = pillLeft; x < pillRight; x += stride) {
                int color = pixels[y * width + x];
                int red = (color >> 16) & 0xff;
                int green = (color >> 8) & 0xff;
                int blue = color & 0xff;
                if (red >= 205 && green >= 205 && blue >= 205) white += 1;
                sampled += 1;
            }
        }
        return white / (float) Math.max(1, sampled);
    }

    private Rect linkStickerTapBounds(Rect icon, int width, int height) {
        int left = Math.max(0, icon.left - Math.round(icon.width() * 0.60f));
        int right = Math.min(width, icon.right + Math.round(width * 0.12f));
        int top = Math.max(0, icon.top - Math.round(icon.height() * 0.45f));
        int bottom = Math.min(height, icon.bottom + Math.round(icon.height() * 0.45f));
        return new Rect(left, top, right, bottom);
    }

    private boolean isCurrentCheckpoint(String... checkpoints) {
        if (preferences == null || activeJob == null || !preferences.shouldRun()) return false;
        String current = preferences.checkpoint();
        for (String checkpoint : checkpoints) if (checkpoint.equals(current)) return true;
        return false;
    }

    private void finishVisualScanFailure(String detail) {
        visualScanInFlight = false;
        if (!isCurrentCheckpoint("opening_stickers", "searching_link_sticker")) return;
        if (stepAttempts >= 8) fail(detail + "; publicação interrompida sem tocar no sticker errado");
        else retry(preferences.checkpoint(), 850);
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

    private AccessibilityNodeInfo findStickerSearchEditor(AccessibilityNodeInfo root) {
        AccessibilityNodeInfo search = findEditableByLabel(root,
                "pesquisar", "pesquisar stickers", "pesquisar figurinhas",
                "search", "search stickers", "search gifs and stickers");
        if (search != null) return search;

        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            AccessibilityNodeInfo node = queue.removeFirst();
            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            boolean searchGeometry = !bounds.isEmpty()
                    && bounds.width() >= screenWidth * 0.65f
                    && bounds.top >= screenHeight * 0.12f
                    && bounds.bottom <= screenHeight * 0.45f;
            if (isEditable(node) && searchGeometry && "link".equals(normalizeWords(node.getText()))) return node;
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
