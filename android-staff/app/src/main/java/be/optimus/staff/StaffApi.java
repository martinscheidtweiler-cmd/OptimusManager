package be.optimus.staff;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class StaffApi {
    private static final String CONFIG_PREFS = "optimus_public_config";
    private static final String CONFIG = "config";
    private static final String CONFIG_URL = "https://optimus-manager.vercel.app/api/config";

    private StaffApi() {}

    static JSONObject getConfig(Context context) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(CONFIG_URL).openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setRequestMethod("GET");
        try {
            int status = connection.getResponseCode();
            String body = read(status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream());
            if (status < 200 || status >= 300) throw new Exception("Configuratie niet beschikbaar (" + status + ")");
            JSONObject config = new JSONObject(body);
            context.getSharedPreferences(CONFIG_PREFS, Context.MODE_PRIVATE).edit()
                    .putString(CONFIG, config.toString()).apply();
            return config;
        } catch (Exception networkError) {
            String cached = context.getSharedPreferences(CONFIG_PREFS, Context.MODE_PRIVATE).getString(CONFIG, null);
            if (cached != null) return new JSONObject(cached);
            throw networkError;
        } finally {
            connection.disconnect();
        }
    }

    static JSONObject action(Context context, String pairingCode, String action, Long target,
                             Double latitude, Double longitude, Double accuracy) throws Exception {
        JSONObject config = getConfig(context);
        String baseUrl = config.getString("url").replaceAll("/+$", "");
        String apiKey = config.optString("publishableKey", config.optString("anonKey", ""));
        if (apiKey.isEmpty()) throw new Exception("Supabase-publieke sleutel ontbreekt");

        JSONObject body = new JSONObject();
        body.put("code", pairingCode);
        body.put("action", action);
        if (target != null) body.put("target", target);
        if (latitude != null) body.put("latitude", latitude);
        if (longitude != null) body.put("longitude", longitude);
        if (accuracy != null) body.put("precision_m", accuracy);

        HttpURLConnection connection = (HttpURLConnection) new URL(baseUrl + "/rest/v1/rpc/staff_phone").openConnection();
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(15000);
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("apikey", apiKey);
        connection.setRequestProperty("Authorization", "Bearer " + apiKey);
        byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream stream = connection.getOutputStream()) { stream.write(payload); }
        try {
            int status = connection.getResponseCode();
            String response = read(status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream());
            if (status < 200 || status >= 300) throw new Exception(errorText(response, status));
            if (response.isEmpty()) return new JSONObject();
            return new JSONObject(response);
        } finally {
            connection.disconnect();
        }
    }

    private static String errorText(String body, int status) {
        try {
            JSONObject json = new JSONObject(body);
            String message = json.optString("message", json.optString("hint", ""));
            if (!message.isEmpty()) return message;
        } catch (Exception ignored) {}
        return "Verbinding mislukt (" + status + ")";
    }

    private static String read(InputStream input) throws Exception {
        if (input == null) return "";
        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = stream.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }
}
