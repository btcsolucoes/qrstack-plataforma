package com.qrstack.agent;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private AgentPreferences preferences;
    private TextView status;
    private Button agentControl;
    private Button updateControl;
    private JSONObject availableRelease;
    private File pendingUpdate;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        preferences = new AgentPreferences(this);
        preferences.migrateStateIfNeeded();
        if (!preferences.shouldRun()) InterruptionGuard.restoreNormalState(this);
        setContentView(buildScreen());
        requestNotificationPermission();
        checkForUpdate(false);
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshStatus();
        if (pendingUpdate != null && pendingUpdate.exists() && canInstallPackages()) installUpdate(pendingUpdate);
    }

    private View buildScreen() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(238, 243, 245));
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(22), dp(28), dp(22), dp(40));
        scroll.addView(content);

        TextView eyebrow = text("QRSTACK OPERADOR", 13, Color.rgb(245, 173, 46), true);
        content.addView(eyebrow);
        TextView title = text("Publicação automática de Stories", 30, Color.rgb(7, 27, 45), true);
        title.setPadding(0, dp(8), 0, dp(8));
        content.addView(title);
        TextView description = text(
                "Este telefone recebe artes aprovadas pela QrStack e conduz a publicação no Instagram. Durante a operação, notificações visuais são silenciadas; ligações não são rejeitadas e provocam pausa com retomada automática.",
                16, Color.rgb(64, 82, 96), false
        );
        description.setLineSpacing(0, 1.18f);
        content.addView(description);

        status = text("Verificando...", 16, Color.WHITE, true);
        status.setPadding(dp(18), dp(16), dp(18), dp(16));
        status.setBackgroundColor(Color.rgb(7, 27, 45));
        LinearLayout.LayoutParams statusParams = blockParams();
        statusParams.setMargins(0, dp(22), 0, dp(18));
        content.addView(status, statusParams);

        content.addView(button("1. PAREAR ESTE TELEFONE", this::enroll));
        content.addView(button("2. Permitir Não Perturbe", view -> openNotificationPolicy()));
        content.addView(button("3. Ativar acessibilidade QrStack", view -> openAccessibilitySettings()));
        content.addView(button("4. Remover restrição de bateria", view -> requestBatteryExemption()));
        agentControl = button("5. INICIAR AGENTE", view -> toggleAgent());
        content.addView(agentControl);
        updateControl = button("VERIFICAR ATUALIZAÇÃO", view -> handleUpdate());
        content.addView(updateControl);

        TextView warning = text(
                "Importante: é um APK privado. Ele não lê mensagens, não captura senhas e não atende nem rejeita ligações. Uma mudança na interface do Instagram pode exigir ajuste do motor antes de uma nova publicação.",
                13, Color.rgb(82, 94, 104), false
        );
        warning.setPadding(0, dp(20), 0, 0);
        content.addView(warning);
        return scroll;
    }

    private void enroll(View ignored) {
        String endpoint = preferences.apiUrl();
        if (!endpoint.startsWith("https://")) {
            toast("O endpoint interno da QrStack está inválido.");
            return;
        }
        status.setText("Pareando com a QrStack...");
        executor.execute(() -> {
            try {
                new ApiClient(this).enroll(Build.MANUFACTURER + " " + Build.MODEL);
                preferences.setEnrolled(true);
                runOnUiThread(() -> {
                    toast("Telefone pareado com sucesso.");
                    refreshStatus();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    status.setText("Pareamento não autorizado. Confira a internet ou libere este telefone na Central.");
                    toast("Não foi possível parear: " + error.getMessage());
                });
            }
        });
    }

    private void handleUpdate() {
        if (availableRelease == null) {
            checkForUpdate(true);
            return;
        }
        downloadUpdate();
    }

    private void checkForUpdate(boolean announceCurrent) {
        if (updateControl != null) {
            updateControl.setEnabled(false);
            updateControl.setText("VERIFICANDO ATUALIZAÇÃO...");
        }
        executor.execute(() -> {
            try {
                JSONObject response = new ApiClient(this).latestRelease();
                String version = response.optString("version", BuildConfig.VERSION_NAME);
                boolean available = compareVersions(version, BuildConfig.VERSION_NAME) > 0;
                availableRelease = available ? response : null;
                runOnUiThread(() -> {
                    updateControl.setEnabled(true);
                    updateControl.setText(available
                            ? "ATUALIZAR AGENTE PARA " + version
                            : "AGENTE ATUALIZADO · " + BuildConfig.VERSION_NAME);
                    if (announceCurrent && !available) toast("Você já está usando a versão mais recente.");
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    updateControl.setEnabled(true);
                    updateControl.setText("TENTAR VERIFICAR ATUALIZAÇÃO");
                    if (announceCurrent) toast("Não foi possível verificar agora: " + error.getMessage());
                });
            }
        });
    }

    private void downloadUpdate() {
        JSONObject release = availableRelease;
        if (release == null) return;
        String source = release.optString("apk_url", "");
        String version = release.optString("version", "nova");
        if (!source.startsWith("https://")) {
            toast("A Central não retornou um APK válido.");
            return;
        }
        updateControl.setEnabled(false);
        updateControl.setText("BAIXANDO " + version + "...");
        executor.execute(() -> {
            try {
                File target = new File(new File(getCacheDir(), "updates"), "QrStack-Agent-" + version + ".apk");
                new ApiClient(this).downloadTo(source, target);
                String expectedHash = release.optString("sha256", "").toLowerCase();
                if (!expectedHash.isEmpty() && !expectedHash.equals(sha256(target))) {
                    target.delete();
                    throw new IllegalStateException("O arquivo recebido não passou na verificação de integridade.");
                }
                pendingUpdate = target;
                runOnUiThread(() -> {
                    updateControl.setEnabled(true);
                    updateControl.setText("INSTALAR ATUALIZAÇÃO " + version);
                    installUpdate(target);
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    updateControl.setEnabled(true);
                    updateControl.setText("TENTAR ATUALIZAR NOVAMENTE");
                    toast("Falha no download da atualização: " + error.getMessage());
                });
            }
        });
    }

    private void installUpdate(File apk) {
        if (!canInstallPackages()) {
            toast("Autorize o QrStack a instalar atualizações. Depois volte para concluir.");
            Intent permission = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName())
            );
            startActivity(permission);
            return;
        }
        Uri content = FileProvider.getUriForFile(this, getPackageName() + ".files", apk);
        pendingUpdate = null;
        Intent installer = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(content, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(installer);
    }

    private boolean canInstallPackages() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getPackageManager().canRequestPackageInstalls();
    }

    private static int compareVersions(String left, String right) {
        String[] a = left.split("\\.");
        String[] b = right.split("\\.");
        int length = Math.max(a.length, b.length);
        for (int index = 0; index < length; index++) {
            int av = index < a.length ? parseVersionPart(a[index]) : 0;
            int bv = index < b.length ? parseVersionPart(b[index]) : 0;
            if (av != bv) return Integer.compare(av, bv);
        }
        return 0;
    }

    private static int parseVersionPart(String value) {
        try {
            return Integer.parseInt(value.replaceAll("[^0-9].*$", ""));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = input.read(buffer)) >= 0) digest.update(buffer, 0, read);
        }
        StringBuilder result = new StringBuilder();
        for (byte value : digest.digest()) result.append(String.format("%02x", value));
        return result.toString();
    }

    private void startAgent() {
        if (!preferences.isEnrolled()) {
            toast("Pareie o telefone primeiro.");
            return;
        }
        if (!isAccessibilityEnabled()) {
            toast("Ative a acessibilidade QrStack antes de iniciar.");
            openAccessibilitySettings();
            return;
        }
        preferences.setShouldRun(true);
        AgentService.start(this);
        toast("Agente iniciado.");
        refreshStatus();
    }

    private void toggleAgent() {
        if (preferences.shouldRun()) stopAgent();
        else startAgent();
    }

    private void stopAgent() {
        preferences.setShouldRun(false);
        InterruptionGuard.restoreNormalState(this);
        AgentService.stop(this);
        toast("Agente pausado. Ele só voltará quando você tocar em Iniciar agente.");
        refreshStatus();
    }

    private void openNotificationPolicy() {
        startActivity(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS));
    }

    private void openAccessibilitySettings() {
        startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
    }

    private void requestBatteryExemption() {
        PowerManager power = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (power != null && power.isIgnoringBatteryOptimizations(getPackageName())) {
            toast("Restrição de bateria já removida.");
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception error) {
            startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        }
    }

    private void refreshStatus() {
        NotificationManager notifications = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        PowerManager power = (PowerManager) getSystemService(Context.POWER_SERVICE);
        boolean dnd = notifications != null && notifications.isNotificationPolicyAccessGranted();
        boolean battery = power != null && power.isIgnoringBatteryOptimizations(getPackageName());
        String value = (preferences.isEnrolled() ? "Pareado" : "Não pareado")
                + "  ·  " + (isAccessibilityEnabled() ? "Acessibilidade ativa" : "Acessibilidade pendente")
                + "\n" + (dnd ? "Não Perturbe autorizado" : "Não Perturbe pendente")
                + "  ·  " + (battery ? "Bateria liberada" : "Bateria restrita")
                + "\nAgente: " + (preferences.shouldRun() ? "em execução" : "parado")
                + "  ·  Etapa: " + preferences.checkpoint()
                + "\nVersão instalada: " + BuildConfig.VERSION_NAME;
        status.setText(value);
        if (agentControl != null) {
            boolean running = preferences.shouldRun();
            agentControl.setText(running ? "PARAR AGENTE AGORA" : "5. INICIAR AGENTE");
            agentControl.setTextColor(Color.WHITE);
            agentControl.setBackgroundColor(running ? Color.rgb(180, 36, 36) : Color.rgb(7, 67, 91));
        }
    }

    private boolean isAccessibilityEnabled() {
        return QrStackAccessibilityService.isEnabled(this);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 91);
        }
    }

    private Button button(String label, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(15);
        button.setAllCaps(false);
        button.setTextColor(Color.WHITE);
        button.setBackgroundColor(Color.rgb(7, 67, 91));
        button.setOnClickListener(listener);
        LinearLayout.LayoutParams params = blockParams();
        params.setMargins(0, dp(6), 0, dp(6));
        button.setLayoutParams(params);
        return button;
    }

    private TextView text(String value, int size, int color, boolean bold) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(size);
        text.setTextColor(color);
        if (bold) text.setTypeface(text.getTypeface(), android.graphics.Typeface.BOLD);
        return text;
    }

    private LinearLayout.LayoutParams blockParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, dp(6), 0, dp(10));
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
}
