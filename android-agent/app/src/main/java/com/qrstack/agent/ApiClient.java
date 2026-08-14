package com.qrstack.agent;

import android.content.Context;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class ApiClient {
    private final Context context;
    private final AgentPreferences preferences;

    ApiClient(Context context) {
        this.context = context.getApplicationContext();
        this.preferences = new AgentPreferences(context);
    }

    JSONObject enroll(String ownerKey, String label) throws IOException, JSONException {
        JSONObject body = baseBody("registerStoryAgent");
        body.put("owner_key", ownerKey);
        body.put("label", label);
        body.put("app_version", BuildConfig.VERSION_NAME);
        return post(body, false);
    }

    StoryJob nextJob() throws IOException, JSONException {
        String query = "?action=getNextStoryJob&device_id=" + encode(preferences.deviceId(context));
        JSONObject response = get(query, true);
        JSONObject job = response.optJSONObject("job");
        return job == null ? null : new StoryJob(job);
    }

    JSONObject updateJob(StoryJob job, String status, String checkpoint, String detail) throws IOException, JSONException {
        JSONObject body = baseBody("updateStoryJob");
        body.put("job_id", job.id);
        body.put("status", status);
        body.put("checkpoint", checkpoint);
        body.put("detail", detail == null ? "" : detail);
        return post(body, true);
    }

    byte[] download(String source) throws IOException {
        HttpURLConnection connection = open(new URL(source), "GET", true);
        connection.connect();
        ensureSuccess(connection);
        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read);
            return output.toByteArray();
        } finally {
            connection.disconnect();
        }
    }

    private JSONObject baseBody(String action) throws JSONException {
        JSONObject body = new JSONObject();
        body.put("action", action);
        body.put("device_id", preferences.deviceId(context));
        body.put("device_token", preferences.deviceToken());
        return body;
    }

    private JSONObject get(String query, boolean authenticated) throws IOException, JSONException {
        HttpURLConnection connection = open(new URL(preferences.apiUrl() + query), "GET", authenticated);
        connection.connect();
        return parse(connection);
    }

    private JSONObject post(JSONObject body, boolean authenticated) throws IOException, JSONException {
        HttpURLConnection connection = open(new URL(preferences.apiUrl()), "POST", authenticated);
        connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
        connection.setDoOutput(true);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }
        return parse(connection);
    }

    private HttpURLConnection open(URL url, String method, boolean authenticated) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(12_000);
        connection.setReadTimeout(20_000);
        connection.setUseCaches(false);
        if (authenticated) connection.setRequestProperty("Authorization", "Bearer " + preferences.deviceToken());
        return connection;
    }

    private JSONObject parse(HttpURLConnection connection) throws IOException, JSONException {
        try {
            ensureSuccess(connection);
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder text = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) text.append(line);
                return new JSONObject(text.toString());
            }
        } finally {
            connection.disconnect();
        }
    }

    private static void ensureSuccess(HttpURLConnection connection) throws IOException {
        int status = connection.getResponseCode();
        if (status >= 200 && status < 300) return;
        throw new IOException("QrStack API HTTP " + status);
    }

    private static String encode(String value) {
        return android.net.Uri.encode(value);
    }
}
