package be.optimus.staff;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.UUID;

/** Small durable outbox. Events keep a UUID across retries so the server can deduplicate them. */
final class StaffOfflineStore {
    private static final String PREFS = "optimus_staff_offline";
    private static final String QUEUE = "queue";
    private static final String CACHE = "last_server_state";
    private static final String SYNCED_AT = "last_synced_at";

    private StaffOfflineStore() {}

    static synchronized JSONObject enqueue(Context context, String action, Long target, long timeMillis) throws Exception {
        JSONArray queue = pending(context);
        JSONObject event = new JSONObject();
        event.put("id", UUID.randomUUID().toString());
        event.put("action", action);
        if (target != null) event.put("target", target);
        event.put("occurred_at", java.time.Instant.ofEpochMilli(timeMillis).toString());
        queue.put(event);
        if (!prefs(context).edit().putString(QUEUE, queue.toString()).commit()) {
            throw new Exception("Offline taak kon niet duurzaam opgeslagen worden.");
        }
        return event;
    }

    static synchronized JSONArray pending(Context context) {
        String raw = prefs(context).getString(QUEUE, "[]");
        try { return new JSONArray(raw); }
        catch (Exception ignored) { return new JSONArray(); }
    }

    static synchronized void remove(Context context, String id) {
        JSONArray original = pending(context);
        JSONArray remaining = new JSONArray();
        for (int i = 0; i < original.length(); i++) {
            JSONObject item = original.optJSONObject(i);
            if (item != null && !id.equals(item.optString("id"))) remaining.put(item);
        }
        prefs(context).edit().putString(QUEUE, remaining.toString()).commit();
    }

    static synchronized void saveState(Context context, JSONObject state) {
        if (state != null) prefs(context).edit().putString(CACHE, state.toString())
                .putLong(SYNCED_AT, System.currentTimeMillis()).commit();
    }

    static synchronized long lastSyncedAt(Context context) {
        return prefs(context).getLong(SYNCED_AT, 0);
    }

    static synchronized JSONObject loadState(Context context) {
        try {
            String raw = prefs(context).getString(CACHE, null);
            return raw == null ? null : new JSONObject(raw);
        } catch (Exception ignored) { return null; }
    }

    static synchronized void clear(Context context) {
        prefs(context).edit().clear().commit();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
