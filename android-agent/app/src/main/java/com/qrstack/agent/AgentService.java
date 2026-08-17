package com.qrstack.agent;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;

import org.json.JSONObject;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public final class AgentService extends Service {
    static final String ACTION_START = "com.qrstack.agent.START";
    static final String ACTION_STOP = "com.qrstack.agent.STOP";
    static final String ACTION_RESUME = "com.qrstack.agent.RESUME";
    static final String ACTION_PUBLISH_PENDING = "com.qrstack.agent.PUBLISH_PENDING";
    private static final String CHANNEL = "qrstack_agent";
    private static final String ALERT_CHANNEL = "qrstack_story_ready";
    private static final int NOTIFICATION_ID = 8142;
    private static final int ALERT_NOTIFICATION_ID = 8143;
    private static final int ACCESSIBILITY_NOTIFICATION_ID = 8144;

    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    private AgentPreferences preferences;
    private ApiClient api;
    private InterruptionGuard guard;
    private volatile boolean busy;
    private static volatile AgentService instance;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        preferences = new AgentPreferences(this);
        preferences.migrateStateIfNeeded();
        api = new ApiClient(this);
        guard = new InterruptionGuard(this);
        if (!preferences.shouldRun() || preferences.activeJobJson().isEmpty()) guard.finish();
        createChannel();
        startForeground(NOTIFICATION_ID, notification("Agente pronto", "Aguardando uma publicação"));
        executor.scheduleWithFixedDelay(this::pollSafely, 1, 12, TimeUnit.SECONDS);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            preferences.setShouldRun(false);
            guard.finish();
            cancelReadyAlert();
            cancelAccessibilityAlert();
            StoryJob job = StoryJob.restore(preferences.activeJobJson());
            if (job == null) {
                stopSelf();
            } else {
                executor.execute(() -> {
                    try {
                        preferences.setCheckpoint("paused_by_operator");
                        api.updateJob(job, "paused_interruption", "paused_by_operator", "Agente pausado manualmente no telefone");
                    } catch (Exception ignored) {
                    } finally {
                        preferences.resetJobState();
                        updateNotification("Agente pausado", "Só será retomado pelo botão Iniciar agente");
                        stopSelf();
                    }
                });
            }
            return START_NOT_STICKY;
        }
        if (ACTION_PUBLISH_PENDING.equals(action)) {
            if (!preferences.shouldRun()) return START_NOT_STICKY;
            cancelReadyAlert();
            executor.execute(this::publishPersistedJobNow);
            return START_STICKY;
        }
        if (ACTION_START.equals(action)) preferences.setShouldRun(true);
        if (ACTION_RESUME.equals(action)) {
            if (!preferences.shouldRun()) {
                guard.finish();
                stopSelf();
                return START_NOT_STICKY;
            }
            executor.execute(this::resumePersistedJob);
        }
        return START_STICKY;
    }

    private void pollSafely() {
        if (!preferences.shouldRun() || !preferences.isEnrolled() || busy) return;
        if (!preferences.activeJobJson().isEmpty()) {
            String checkpoint = preferences.checkpoint();
            // The accessibility service owns every Instagram checkpoint. Reopening
            // the composer while it is moving a sticker destroys the current Story.
            if ("claimed".equals(checkpoint) || "downloading_media".equals(checkpoint)) {
                resumePersistedJob();
            } else if ("awaiting_operator_confirmation".equals(checkpoint)) {
                StoryJob job = StoryJob.restore(preferences.activeJobJson());
                if (job != null) showStoryReadyAlert(job);
            } else if ("awaiting_accessibility".equals(checkpoint)) {
                showAccessibilityAlert();
            }
            return;
        }
        busy = true;
        try {
            StoryJob job = api.nextJob();
            if (job != null) prepare(job);
        } catch (Exception error) {
            String message = error.getMessage() == null ? "" : error.getMessage();
            if (message.startsWith("Atualização obrigatória")) {
                updateNotification("Atualize o agente", message);
            } else {
                updateNotification("Conexão em espera", "Nova tentativa automática em instantes");
            }
        } finally {
            busy = false;
        }
    }

    private void prepare(StoryJob job) throws Exception {
        if (!preferences.shouldRun()) return;
        preferences.setActiveJobJson(job.toJson().toString());
        preferences.setCheckpoint("downloading_media");
        updateNotification("Preparando Story", job.restaurantSlug);
        api.updateJob(job, "preparing", "downloading_media", "Arte sendo preparada no telefone");
        byte[] media;
        Uri uri;
        try {
            media = api.download(job.mediaUrl);
            uri = MediaStoreHelper.saveStory(this, job, media);
            preferences.resetRecoveryAttempts();
        } catch (Exception error) {
            int attempts = preferences.incrementRecoveryAttempts();
            if (attempts >= 3) {
                try {
                    api.updateJob(job, "failed_attention", "media_unavailable",
                            "A arte não pôde ser baixada após 3 tentativas; job preservado e fila liberada");
                } catch (Exception ignored) {
                }
                preferences.resetJobState();
                updateNotification("Arte indisponível", "A fila seguirá para a próxima publicação");
            }
            throw error;
        }
        if (!preferences.shouldRun()) return;
        preferences.setMediaUri(uri.toString());
        copyStoryLink(job.storyLink);
        if (QrStackAccessibilityService.isInstagramForeground()) {
            preferences.setCheckpoint("awaiting_operator_confirmation");
            api.updateJob(job, "publishing", "awaiting_operator_confirmation", "Instagram já estava em uso; aguardando confirmação pelo telefone");
            showStoryReadyAlert(job);
            return;
        }
        publishNow(job, "Arte salva, link copiado e compositor de Story sendo aberto");
    }

    private void resumePersistedJob() {
        if (busy || !preferences.shouldRun()) return;
        StoryJob job = StoryJob.restore(preferences.activeJobJson());
        if (job == null) return;
        busy = true;
        try {
            if (preferences.mediaUri().isEmpty() && !job.mediaUrl.isEmpty()) {
                prepare(job);
            } else if ("awaiting_operator_confirmation".equals(preferences.checkpoint())) {
                copyStoryLink(job.storyLink);
                showStoryReadyAlert(job);
            } else {
                copyStoryLink(job.storyLink);
                publishNow(job, "Retomada automática no último ponto seguro");
            }
        } catch (Exception error) {
            updateNotification("Publicação pausada", "Aguardando recuperação automática");
        } finally {
            busy = false;
        }
    }

    void complete(StoryJob job) {
        executor.execute(() -> {
            try {
                api.updateJob(job, "completed", "published", "Story publicado e fluxo concluído");
            } catch (Exception ignored) {
            } finally {
                preferences.resetJobState();
                guard.finish();
                cancelReadyAlert();
                cancelAccessibilityAlert();
                updateNotification("Story publicado", job.restaurantSlug);
            }
        });
    }

    void pauseForInterruption(StoryJob job, String detail) {
        executor.execute(() -> {
            try {
                api.updateJob(job, "paused_interruption", "paused_interruption", detail);
            } catch (Exception ignored) {
            }
            preferences.setCheckpoint("paused_interruption");
            updateNotification("Publicação pausada", "Retomada automática após a interrupção");
        });
    }

    void failForAttention(StoryJob job, String detail) {
        executor.execute(() -> {
            try {
                api.updateJob(job, "failed_attention", "manual_attention", detail);
            } catch (Exception ignored) {
            } finally {
                preferences.resetJobState();
                guard.finish();
                cancelReadyAlert();
                cancelAccessibilityAlert();
                updateNotification("Atenção necessária", detail);
            }
        });
    }

    void checkpoint(StoryJob job, String checkpoint, String detail) {
        executor.execute(() -> {
            try {
                api.updateJob(job, "publishing", checkpoint, detail);
            } catch (Exception ignored) {
            }
        });
    }

    static AgentService current() {
        return instance;
    }

    private void requestInstagramStoryComposer(StoryJob job) {
        requestInstagramStoryComposer(job, 0);
    }

    private void requestInstagramStoryComposer(StoryJob job, int attempt) {
        if (!preferences.shouldRun()) return;
        if (QrStackAccessibilityService.requestInstagramStoryComposer(preferences.mediaUri())) {
            cancelAccessibilityAlert();
            updateNotification("Publicando Story", "Não Perturbe ativo durante a operação");
            return;
        }
        if (QrStackAccessibilityService.isEnabled(this) && attempt < 12) {
            updateNotification("Conectando acessibilidade", "Aguardando o Android liberar o serviço QrStack");
            executor.schedule(() -> requestInstagramStoryComposer(job, attempt + 1), 750, TimeUnit.MILLISECONDS);
            return;
        }
        pauseForAccessibility(job, QrStackAccessibilityService.isEnabled(this)
                ? "O Android não reconectou a acessibilidade QrStack"
                : "A acessibilidade QrStack está desativada");
    }

    private void pauseForAccessibility(StoryJob job, String detail) {
        guard.finish();
        preferences.setCheckpoint("awaiting_accessibility");
        try {
            api.updateJob(job, "paused_interruption", "awaiting_accessibility", detail);
        } catch (Exception ignored) {
        }
        showAccessibilityAlert();
        updateNotification("Acessibilidade aguardando", "Toque em ATIVAR E CONTINUAR");
    }

    private void publishPersistedJobNow() {
        if (busy || !preferences.shouldRun()) return;
        StoryJob job = StoryJob.restore(preferences.activeJobJson());
        if (job == null || preferences.mediaUri().isEmpty()) return;
        busy = true;
        try {
            copyStoryLink(job.storyLink);
            publishNow(job, "Publicação confirmada no telefone; link copiado");
        } catch (Exception error) {
            failForAttention(job, "Não foi possível abrir o Story após a confirmação");
        } finally {
            busy = false;
        }
    }

    private void publishNow(StoryJob job, String detail) throws Exception {
        if (!preferences.shouldRun()) return;
        guard.begin();
        preferences.setCheckpoint("opening_story_composer");
        api.updateJob(job, "publishing", "opening_story_composer", detail);
        requestInstagramStoryComposer(job);
    }

    private void copyStoryLink(String link) {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard != null && link != null && !link.isEmpty()) {
            clipboard.setPrimaryClip(ClipData.newPlainText("Link do cardápio", link));
        }
    }

    private void createChannel() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Publicação QrStack", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Mantém a fila de Stories ativa");
        manager.createNotificationChannel(channel);
        NotificationChannel alerts = new NotificationChannel(ALERT_CHANNEL, "Story pronto para publicar", NotificationManager.IMPORTANCE_HIGH);
        alerts.setDescription("Avisa quando um formulário foi preenchido durante o uso do Instagram");
        alerts.enableVibration(true);
        manager.createNotificationChannel(alerts);
    }

    private Notification notification(String title, String detail) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder builder = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_qrstack)
                .setContentTitle(title)
                .setContentText(detail)
                .setContentIntent(pending)
                .setOngoing(true);
        if (preferences != null && preferences.shouldRun()) {
            Intent stopIntent = new Intent(this, AgentService.class).setAction(ACTION_STOP);
            PendingIntent stop = PendingIntent.getService(this, 2, stopIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            builder.addAction(0, "PARAR", stop);
        }
        return builder.build();
    }

    private void showStoryReadyAlert(StoryJob job) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        Intent publishIntent = new Intent(this, AgentService.class).setAction(ACTION_PUBLISH_PENDING);
        PendingIntent publish = PendingIntent.getService(this, 3, publishIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent stopIntent = new Intent(this, AgentService.class).setAction(ACTION_STOP);
        PendingIntent stop = PendingIntent.getService(this, 4, stopIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification alert = new Notification.Builder(this, ALERT_CHANNEL)
                .setSmallIcon(R.drawable.ic_qrstack)
                .setContentTitle("Formulário preenchido: " + job.restaurantSlug)
                .setContentText("Arte pronta e link copiado. Confirme a conta e publique o Story.")
                .setPriority(Notification.PRIORITY_HIGH)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setAutoCancel(false)
                .setOngoing(true)
                .addAction(0, "PUBLICAR AGORA", publish)
                .addAction(0, "PARAR", stop)
                .build();
        manager.notify(ALERT_NOTIFICATION_ID, alert);
        updateNotification("Story aguardando confirmação", "O Instagram já estava em uso");
    }

    private void cancelReadyAlert() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.cancel(ALERT_NOTIFICATION_ID);
    }

    private void showAccessibilityAlert() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        Intent settingsIntent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent settings = PendingIntent.getActivity(this, 5, settingsIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent stopIntent = new Intent(this, AgentService.class).setAction(ACTION_STOP);
        PendingIntent stop = PendingIntent.getService(this, 6, stopIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification alert = new Notification.Builder(this, ALERT_CHANNEL)
                .setSmallIcon(R.drawable.ic_qrstack)
                .setContentTitle("Acessibilidade QrStack precisa reconectar")
                .setContentText("Ative o serviço e o Story continuará sem criar outro envio.")
                .setPriority(Notification.PRIORITY_HIGH)
                .setCategory(Notification.CATEGORY_ERROR)
                .setOngoing(true)
                .addAction(0, "ATIVAR E CONTINUAR", settings)
                .addAction(0, "PARAR", stop)
                .build();
        manager.notify(ACCESSIBILITY_NOTIFICATION_ID, alert);
    }

    private void cancelAccessibilityAlert() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.cancel(ACCESSIBILITY_NOTIFICATION_ID);
    }

    private void updateNotification(String title, String detail) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, notification(title, detail));
    }

    static void start(android.content.Context context) {
        Intent intent = new Intent(context, AgentService.class).setAction(ACTION_START);
        context.startForegroundService(intent);
    }

    static void resume(android.content.Context context) {
        AgentPreferences preferences = new AgentPreferences(context);
        if (!preferences.shouldRun()) return;
        Intent intent = new Intent(context, AgentService.class).setAction(ACTION_RESUME);
        context.startForegroundService(intent);
    }

    static void stop(android.content.Context context) {
        AgentPreferences preferences = new AgentPreferences(context);
        preferences.setShouldRun(false);
        Intent intent = new Intent(context, AgentService.class).setAction(ACTION_STOP);
        context.startForegroundService(intent);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        instance = null;
        executor.shutdownNow();
        guard.finish();
        super.onDestroy();
    }
}
