package com.qrstack.agent;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;

import org.json.JSONObject;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public final class AgentService extends Service {
    static final String ACTION_START = "com.qrstack.agent.START";
    static final String ACTION_STOP = "com.qrstack.agent.STOP";
    static final String ACTION_RESUME = "com.qrstack.agent.RESUME";
    private static final String CHANNEL = "qrstack_agent";
    private static final int NOTIFICATION_ID = 8142;

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
                        updateNotification("Agente pausado", "Só será retomado pelo botão Iniciar agente");
                        stopSelf();
                    }
                });
            }
            return START_NOT_STICKY;
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
            resumePersistedJob();
            return;
        }
        busy = true;
        try {
            StoryJob job = api.nextJob();
            if (job != null) prepare(job);
        } catch (Exception error) {
            updateNotification("Conexão em espera", "Nova tentativa automática em instantes");
        } finally {
            busy = false;
        }
    }

    private void prepare(StoryJob job) throws Exception {
        if (!preferences.shouldRun()) return;
        preferences.setActiveJobJson(job.toJson().toString());
        preferences.setCheckpoint("downloading_media");
        guard.begin();
        updateNotification("Preparando Story", job.restaurantSlug);
        api.updateJob(job, "preparing", "downloading_media", "Arte sendo preparada no telefone");
        byte[] media = api.download(job.mediaUrl);
        Uri uri = MediaStoreHelper.saveStory(this, job, media);
        if (!preferences.shouldRun()) return;
        preferences.setMediaUri(uri.toString());
        preferences.setCheckpoint("opening_story_composer");
        api.updateJob(job, "publishing", "opening_story_composer", "Arte salva e compositor de Story sendo aberto");
        requestInstagramStoryComposer(job);
    }

    private void resumePersistedJob() {
        if (busy || !preferences.shouldRun()) return;
        StoryJob job = StoryJob.restore(preferences.activeJobJson());
        if (job == null) return;
        busy = true;
        try {
            guard.begin();
            if (preferences.mediaUri().isEmpty() && !job.mediaUrl.isEmpty()) {
                prepare(job);
            } else {
                api.updateJob(job, "publishing", "resuming_after_interruption", "Retomada automática no último ponto seguro");
                preferences.setCheckpoint("opening_story_composer");
                requestInstagramStoryComposer(job);
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
                guard.finish();
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
        if (!preferences.shouldRun()) return;
        if (QrStackAccessibilityService.requestInstagramStoryComposer(preferences.mediaUri())) {
            updateNotification("Publicando Story", "Não Perturbe ativo durante a operação");
            return;
        }
        failForAttention(job, "Ative o serviço de acessibilidade QrStack para abrir o Instagram");
    }

    private void createChannel() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Publicação QrStack", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Mantém a fila de Stories ativa");
        manager.createNotificationChannel(channel);
    }

    private Notification notification(String title, String detail) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_qrstack)
                .setContentTitle(title)
                .setContentText(detail)
                .setContentIntent(pending)
                .setOngoing(true)
                .build();
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
