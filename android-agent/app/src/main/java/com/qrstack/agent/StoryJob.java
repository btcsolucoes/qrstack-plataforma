package com.qrstack.agent;

import org.json.JSONException;
import org.json.JSONObject;

final class StoryJob {
    final String id;
    final String restaurantSlug;
    final String storyLink;
    final String mediaUrl;
    final String status;
    final String checkpoint;

    StoryJob(JSONObject json) throws JSONException {
        id = json.getString("id");
        restaurantSlug = json.optString("restaurant_slug", "restaurant");
        storyLink = json.getString("story_link");
        mediaUrl = json.optString("media_url", "");
        status = json.optString("status", "claimed");
        checkpoint = json.optString("checkpoint", "claimed");
    }

    JSONObject toJson() {
        JSONObject json = new JSONObject();
        try {
            json.put("id", id);
            json.put("restaurant_slug", restaurantSlug);
            json.put("story_link", storyLink);
            json.put("media_url", mediaUrl);
            json.put("status", status);
            json.put("checkpoint", checkpoint);
        } catch (JSONException ignored) {
        }
        return json;
    }

    static StoryJob restore(String value) {
        try {
            return value == null || value.isEmpty() ? null : new StoryJob(new JSONObject(value));
        } catch (JSONException error) {
            return null;
        }
    }
}
