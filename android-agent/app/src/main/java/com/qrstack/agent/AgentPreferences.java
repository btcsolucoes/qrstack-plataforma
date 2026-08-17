package com.qrstack.agent;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;

import java.security.SecureRandom;
import java.util.Base64;

final class AgentPreferences {
    private static final String FILE = "qrstack_agent";
    private static final int STATE_SCHEMA_VERSION = 17;
    private final SharedPreferences preferences;

    AgentPreferences(Context context) {
        preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    String apiUrl() {
        return preferences.getString("api_url", BuildConfig.DEFAULT_API_URL);
    }

    void setApiUrl(String value) {
        preferences.edit().putString("api_url", value.replaceAll("/+$", "")).apply();
    }

    String deviceId(Context context) {
        String current = preferences.getString("device_id", "");
        if (!current.isEmpty()) return current;
        String androidId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        current = "android-" + (androidId == null ? randomToken(12) : androidId);
        preferences.edit().putString("device_id", current).apply();
        return current;
    }

    String deviceToken() {
        String current = preferences.getString("device_token", "");
        if (!current.isEmpty()) return current;
        current = randomToken(48);
        preferences.edit().putString("device_token", current).apply();
        return current;
    }

    boolean isEnrolled() {
        return preferences.getBoolean("enrolled", false);
    }

    void setEnrolled(boolean value) {
        preferences.edit().putBoolean("enrolled", value).apply();
    }

    boolean shouldRun() {
        return preferences.getBoolean("should_run", false);
    }

    void setShouldRun(boolean value) {
        preferences.edit().putBoolean("should_run", value).apply();
    }

    boolean interruptionGuardActive() {
        return preferences.getBoolean("interruption_guard_active", false);
    }

    int previousInterruptionFilter() {
        return preferences.getInt("previous_interruption_filter", 1);
    }

    void saveInterruptionGuard(int previousFilter) {
        preferences.edit()
                .putBoolean("interruption_guard_active", true)
                .putInt("previous_interruption_filter", previousFilter)
                .commit();
    }

    void clearInterruptionGuard() {
        preferences.edit()
                .putBoolean("interruption_guard_active", false)
                .remove("previous_interruption_filter")
                .commit();
    }

    boolean migrateStateIfNeeded() {
        int current = preferences.getInt("state_schema_version", 1);
        if (current >= STATE_SCHEMA_VERSION) return false;
        preferences.edit()
                .putInt("state_schema_version", STATE_SCHEMA_VERSION)
                .putBoolean("should_run", false)
                .putString("active_job", "")
                .putString("checkpoint", "idle")
                .putString("media_uri", "")
                .putInt("recovery_attempts", 0)
                .commit();
        return true;
    }

    String activeJobJson() {
        return preferences.getString("active_job", "");
    }

    void setActiveJobJson(String json) {
        preferences.edit().putString("active_job", json == null ? "" : json).apply();
    }

    String checkpoint() {
        return preferences.getString("checkpoint", "idle");
    }

    void setCheckpoint(String checkpoint) {
        preferences.edit().putString("checkpoint", checkpoint).apply();
    }

    String mediaUri() {
        return preferences.getString("media_uri", "");
    }

    void setMediaUri(String value) {
        preferences.edit().putString("media_uri", value == null ? "" : value).apply();
    }

    int recoveryAttempts() {
        return preferences.getInt("recovery_attempts", 0);
    }

    int incrementRecoveryAttempts() {
        int next = recoveryAttempts() + 1;
        preferences.edit().putInt("recovery_attempts", next).apply();
        return next;
    }

    void resetJobState() {
        preferences.edit()
                .putString("active_job", "")
                .putString("checkpoint", "idle")
                .putString("media_uri", "")
                .putInt("recovery_attempts", 0)
                .apply();
    }

    private static String randomToken(int bytes) {
        byte[] value = new byte[bytes];
        new SecureRandom().nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }
}
