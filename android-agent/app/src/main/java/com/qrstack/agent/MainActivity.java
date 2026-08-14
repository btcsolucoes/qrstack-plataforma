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
import android.text.InputType;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private AgentPreferences preferences;
    private TextView status;
    private EditText apiUrl;
    private EditText ownerKey;
    private Button agentControl;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        preferences = new AgentPreferences(this);
        preferences.migrateStateIfNeeded();
        if (!preferences.shouldRun()) InterruptionGuard.restoreNormalState(this);
        setContentView(buildScreen());
        requestNotificationPermission();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshStatus();
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

        apiUrl = field("Endpoint QrStack", preferences.apiUrl(), false);
        content.addView(apiUrl, blockParams());
        ownerKey = field("Chave da Central (somente no pareamento)", "", true);
        content.addView(ownerKey, blockParams());

        content.addView(button("1. Parear este telefone", this::enroll));
        content.addView(button("2. Permitir Não Perturbe", view -> openNotificationPolicy()));
        content.addView(button("3. Ativar acessibilidade QrStack", view -> openAccessibilitySettings()));
        content.addView(button("4. Remover restrição de bateria", view -> requestBatteryExemption()));
        agentControl = button("5. INICIAR AGENTE", view -> toggleAgent());
        content.addView(agentControl);

        TextView warning = text(
                "Importante: é um APK privado. Ele não lê mensagens, não captura senhas e não atende nem rejeita ligações. Uma mudança na interface do Instagram pode exigir ajuste do motor antes de uma nova publicação.",
                13, Color.rgb(82, 94, 104), false
        );
        warning.setPadding(0, dp(20), 0, 0);
        content.addView(warning);
        return scroll;
    }

    private void enroll(View ignored) {
        String endpoint = apiUrl.getText().toString().trim();
        String key = ownerKey.getText().toString().trim();
        if (!endpoint.startsWith("https://") || key.length() < 6) {
            toast("Preencha o endpoint HTTPS e a chave da Central.");
            return;
        }
        preferences.setApiUrl(endpoint);
        status.setText("Pareando com a QrStack...");
        executor.execute(() -> {
            try {
                new ApiClient(this).enroll(key, Build.MANUFACTURER + " " + Build.MODEL);
                preferences.setEnrolled(true);
                runOnUiThread(() -> {
                    ownerKey.setText("");
                    toast("Telefone pareado com sucesso.");
                    refreshStatus();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    status.setText("Pareamento falhou. Confira a chave e a internet.");
                    toast("Não foi possível parear: " + error.getMessage());
                });
            }
        });
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
                + "  ·  Etapa: " + preferences.checkpoint();
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

    private EditText field(String hint, String value, boolean secret) {
        EditText field = new EditText(this);
        field.setHint(hint);
        field.setText(value);
        field.setTextSize(15);
        field.setSingleLine(true);
        field.setPadding(dp(14), dp(12), dp(14), dp(12));
        field.setBackgroundColor(Color.WHITE);
        if (secret) field.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        return field;
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
