package com.qrstack.agent;

import android.app.NotificationManager;
import android.content.Context;
import android.os.PowerManager;

final class InterruptionGuard {
    private final Context context;
    private final NotificationManager notificationManager;
    private PowerManager.WakeLock wakeLock;
    private int previousFilter = NotificationManager.INTERRUPTION_FILTER_ALL;
    private boolean active;

    InterruptionGuard(Context context) {
        this.context = context.getApplicationContext();
        notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    @SuppressWarnings("deprecation")
    synchronized void begin() {
        if (active) return;
        active = true;
        if (notificationManager != null && notificationManager.isNotificationPolicyAccessGranted()) {
            previousFilter = notificationManager.getCurrentInterruptionFilter();
            notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE);
        }
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (power != null) {
            int flags = PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP;
            wakeLock = power.newWakeLock(flags, "QrStack:StoryPublish");
            wakeLock.acquire(20 * 60 * 1000L);
        }
    }

    synchronized void finish() {
        if (!active) return;
        active = false;
        if (notificationManager != null && notificationManager.isNotificationPolicyAccessGranted()) {
            notificationManager.setInterruptionFilter(previousFilter);
        }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
    }

    static boolean isCallPackage(String packageName) {
        return packageName != null && (
                packageName.contains("incallui")
                        || packageName.contains("dialer")
                        || packageName.equals("com.samsung.android.app.telephonyui")
                        || packageName.equals("com.android.server.telecom")
        );
    }
}
