package be.optimus.staff;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Native staff time-tracking screen. Supabase remains the source of truth for all timestamps. */
public class MainActivity extends Activity {
    private static final int LOCATION_PERMISSION = 42;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private LinearLayout root;
    private String pairingCode;
    private JSONObject state;
    private String error = "";
    private boolean busy;
    private Long selectedLocation;
    private boolean showContacts;
    private long lockedUntil;
    private int failedAttempts;
    private boolean pendingNotificationPermission;
    private TextView timerView;
    private String timerStart;

    private final Runnable timerTick = new Runnable() {
        @Override public void run() {
            if (!isFinishing() && timerView != null && timerStart != null) timerView.setText(elapsed(timerStart));
            main.postDelayed(this, 1000);
        }
    };

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xfff7f7f7);
        getWindow().setNavigationBarColor(0xfff7f7f7);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        loadSavedPairing();
        main.post(timerTick);
    }

    private void loadSavedPairing() {
        setBusy(true);
        io.execute(() -> {
            try {
                String saved = DeviceSecretStore.read(this);
                main.post(() -> {
                    pairingCode = saved;
                    if (saved == null || saved.isEmpty()) { setBusy(false); render(); }
                    else requestState("load", null, saved, true);
                });
            } catch (Exception e) {
                main.post(() -> { DeviceSecretStore.clear(this); pairingCode = null; setBusy(false); fail("Gekoppelde telefoon kon niet veilig worden gelezen. Koppel opnieuw."); });
            }
        });
    }

    private void requestState(String action, Long target, String code, boolean initial) {
        setBusy(true);
        io.execute(() -> {
            try {
                JSONObject response = StaffApi.action(this, code, action, target, null, null, null);
                if ("clear_position".equals(action)) response = StaffApi.action(this, code, "load", null, null, null, null);
                final JSONObject result = response;
                main.post(() -> {
                    state = result;
                    error = "";
                    if ("end".equals(action)) { selectedLocation = null; showContacts = false; stopLocationService(); }
                    setBusy(false);
                    render();
                });
            } catch (Exception e) {
                main.post(() -> {
                    setBusy(false);
                    if (initial && (e.getMessage() != null && (e.getMessage().contains("not authorized") || e.getMessage().contains("Device not authorized")))) {
                        DeviceSecretStore.clear(this);
                        pairingCode = null;
                    }
                    fail(e.getMessage() == null ? "Geen verbinding met Optimus Tasks." : e.getMessage());
                });
            }
        });
    }

    private void pair(String candidate) {
        String value = candidate.trim().toLowerCase(Locale.ROOT);
        if (!value.matches("[0-9a-f]{64}")) { fail("De koppelcode heeft niet het juiste formaat."); return; }
        setBusy(true);
        io.execute(() -> {
            try {
                JSONObject result = StaffApi.action(this, value, "load", null, null, null, null);
                DeviceSecretStore.save(this, value);
                main.post(() -> { pairingCode = value; state = result; error = ""; setBusy(false); render(); });
            } catch (Exception e) {
                main.post(() -> { setBusy(false); fail("Koppelcode ongeldig of ingetrokken. Controleer internet en probeer opnieuw."); });
            }
        });
    }

    private void change(String action, Long target) {
        if (busy || pairingCode == null) return;
        requestState(action, target, pairingCode, false);
    }

    private void render() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(12), dp(18), dp(22));
        root.setBackgroundColor(0xfff7f7f7);
        scroll.addView(root);
        setContentView(scroll);

        JSONObject shift = state == null ? null : state.optJSONObject("shift");
        TextView top = label(shift == null ? "OPTIMUS TASKS" : workerName(shift.optLong("worker_id")), 15, true);
        top.setGravity(Gravity.CENTER_VERTICAL);
        root.addView(top, params(-1, dp(38)));
        if (!error.isEmpty()) {
            TextView message = label(error, 13, false);
            message.setTextColor(0xff9a2e2e);
            root.addView(message, params(-1, -2));
        }

        if (busy && state == null && pairingCode == null) {
            root.addView(label("Laden…", 16, false));
            return;
        }
        if (pairingCode == null) { renderPairing(); return; }
        if (shift == null) { renderWorkerSelection(); return; }
        renderWorkday(shift);
    }

    private void renderPairing() {
        root.addView(label("Werktelefoon koppelen", 19, true), params(-1, dp(52)));
        root.addView(label("Maak een eenmalige koppelcode in Optimus Manager → Personeel → Beheer.", 14, false));
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setHint("Koppelcode");
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        input.setAutofillHints();
        root.addView(input, params(-1, dp(54)));
        Button submit = button("Telefoon koppelen");
        submit.setOnClickListener(v -> pair(input.getText().toString()));
        root.addView(submit, params(-1, dp(52)));
    }

    private void renderWorkerSelection() {
        root.addView(label("Wie ben je vandaag?", 19, true), params(-1, dp(54)));
        root.addView(label("Kies je naam om je werkdag te starten.", 14, false));
        JSONArray workers = state == null ? new JSONArray() : state.optJSONArray("workers");
        if (workers == null || workers.length() == 0) root.addView(label("Er zijn geen actieve medewerkers ingesteld.", 14, false));
        for (int i = 0; workers != null && i < workers.length(); i++) {
            JSONObject worker = workers.optJSONObject(i);
            if (worker == null) continue;
            long id = worker.optLong("id");
            Button b = button(worker.optString("name", "Medewerker") + "   ›");
            b.setOnClickListener(v -> change("begin", id));
            root.addView(b, params(-1, dp(58)));
        }
    }

    private void renderWorkday(JSONObject shift) {
        JSONObject entry = state.optJSONObject("entry");
        String location = entry == null ? "" : locationName(taskLocationId(entry.optLong("task_id")));
        String taskName = entry == null ? "Geen actieve taak" : taskName(entry.optLong("task_id"));
        root.addView(label("HUIDIGE TAAK", 11, false), params(-1, dp(28)));
        root.addView(label(entry == null ? taskName : taskName + " · " + location, 18, true), params(-1, dp(44)));
        TextView clock = label(entry == null ? "00:00:00" : elapsed(entry.optString("started_at")), 40, true);
        clock.setTypeface(android.graphics.Typeface.MONOSPACE, android.graphics.Typeface.BOLD);
        timerView = clock;
        timerStart = entry == null ? null : entry.optString("started_at", null);
        root.addView(clock, params(-1, dp(64)));
        if (entry != null) {
            Button stop = button("Stop taak");
            stop.setOnClickListener(v -> change("stop", null));
            root.addView(stop, params(-1, dp(50)));
        }

        boolean sharing = getSharedPreferences("optimus_gps_state", MODE_PRIVATE).getBoolean("active", false);
        TextView gps = label("GPS · " + (sharing ? "actief" : "uit"), 12, false);
        gps.setTextColor(0xff666666);
        root.addView(gps, params(-1, dp(36)));
        Button gpsToggle = button(sharing ? "Locatie delen stoppen" : "Locatie delen inschakelen");
        gpsToggle.setOnClickListener(v -> { if (sharing) disableGps(); else requestGpsPermissions(); });
        root.addView(gpsToggle, params(-1, dp(46)));

        if (showContacts) { renderContacts(); return; }
        if (selectedLocation != null) { renderTasksForLocation(selectedLocation); return; }
        root.addView(label("Taken per locatie", 17, true), params(-1, dp(48)));
        JSONArray locations = state.optJSONArray("locations");
        GridLayout grid = new GridLayout(this);
        grid.setColumnCount(2);
        for (int i = 0; locations != null && i < locations.length(); i++) {
            JSONObject item = locations.optJSONObject(i);
            if (item == null) continue;
            long id = item.optLong("id");
            Button b = button(item.optString("name", "Locatie"));
            b.setOnClickListener(v -> { selectedLocation = id; render(); });
            GridLayout.LayoutParams lp = new GridLayout.LayoutParams();
            lp.width = 0;
            lp.height = dp(64);
            lp.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1, 1f);
            lp.setMargins(dp(3), dp(3), dp(3), dp(3));
            grid.addView(b, lp);
        }
        root.addView(grid, params(-1, -2));
        Button contacts = button("Contact");
        contacts.setOnClickListener(v -> { showContacts = true; render(); });
        root.addView(contacts, params(-1, dp(50)));
        Button end = button("Werkdag beëindigen");
        end.setOnClickListener(v -> new AlertDialog.Builder(this).setMessage("Werkdag beëindigen?")
                .setNegativeButton("Annuleren", null).setPositiveButton("Beëindigen", (d, w) -> change("end", null)).show());
        root.addView(end, params(-1, dp(50)));
    }

    private void renderTasksForLocation(long locationId) {
        Button back = button("← Locaties");
        back.setOnClickListener(v -> { selectedLocation = null; render(); });
        root.addView(back, params(-1, dp(46)));
        root.addView(label(locationName(locationId), 18, true), params(-1, dp(48)));
        JSONArray tasks = state.optJSONArray("tasks");
        for (int i = 0; tasks != null && i < tasks.length(); i++) {
            JSONObject item = tasks.optJSONObject(i);
            if (item == null || item.optLong("location_id") != locationId) continue;
            long id = item.optLong("id");
            Button b = button(item.optString("name", "Taak") + "   ›");
            b.setOnClickListener(v -> change("task", id));
            root.addView(b, params(-1, dp(58)));
        }
    }

    private void renderContacts() {
        Button back = button("← Terug");
        back.setOnClickListener(v -> { showContacts = false; render(); });
        root.addView(back, params(-1, dp(46)));
        root.addView(label("Contact", 18, true), params(-1, dp(48)));
        JSONArray contacts = state.optJSONArray("contacts");
        for (int i = 0; contacts != null && i < contacts.length(); i++) {
            JSONObject item = contacts.optJSONObject(i);
            if (item == null) continue;
            String name = item.optString("name", "Contact");
            String phone = item.optString("phone", "").trim();
            root.addView(label(name, 16, true), params(-1, dp(38)));
            if (phone.isEmpty() || "null".equals(phone)) {
                root.addView(label("Telefoonnummer nog niet ingesteld", 13, false));
            } else {
                LinearLayout row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                Button call = button("Bellen");
                call.setOnClickListener(v -> startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(phone)))));
                Button sms = button("Bericht");
                sms.setOnClickListener(v -> startActivity(new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(phone)))));
                row.addView(call, new LinearLayout.LayoutParams(0, dp(48), 1f));
                row.addView(sms, new LinearLayout.LayoutParams(0, dp(48), 1f));
                root.addView(row, params(-1, dp(50)));
            }
        }
    }

    private long taskLocationId(long taskId) {
        JSONArray tasks = state.optJSONArray("tasks");
        for (int i = 0; tasks != null && i < tasks.length(); i++) {
            JSONObject item = tasks.optJSONObject(i);
            if (item != null && item.optLong("id") == taskId) return item.optLong("location_id");
        }
        return -1;
    }

    private String taskName(long taskId) {
        JSONArray tasks = state == null ? null : state.optJSONArray("tasks");
        for (int i = 0; tasks != null && i < tasks.length(); i++) {
            JSONObject item = tasks.optJSONObject(i);
            if (item != null && item.optLong("id") == taskId) return item.optString("name", "Taak");
        }
        return "Taak";
    }

    private String locationName(long locationId) {
        JSONArray locations = state == null ? null : state.optJSONArray("locations");
        for (int i = 0; locations != null && i < locations.length(); i++) {
            JSONObject item = locations.optJSONObject(i);
            if (item != null && item.optLong("id") == locationId) return item.optString("name", "Locatie");
        }
        return "";
    }

    private String workerName(long workerId) {
        JSONArray workers = state == null ? null : state.optJSONArray("workers");
        for (int i = 0; workers != null && i < workers.length(); i++) {
            JSONObject item = workers.optJSONObject(i);
            if (item != null && item.optLong("id") == workerId) return item.optString("name", "Medewerker");
        }
        return "Werkdag actief";
    }

    private String elapsed(String timestamp) {
        try {
            Instant start = Instant.parse(timestamp);
            long seconds = Math.max(0, Duration.between(start, Instant.now()).getSeconds());
            return String.format(Locale.ROOT, "%02d:%02d:%02d", seconds / 3600, (seconds / 60) % 60, seconds % 60);
        } catch (Exception e) { return "00:00:00"; }
    }

    private void setBusy(boolean value) { busy = value; }
    private void fail(String message) { error = message; render(); }
    private TextView label(String text, int size, boolean bold) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(size);
        view.setTextColor(0xff171717);
        view.setGravity(Gravity.CENTER_VERTICAL);
        if (bold) view.setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD);
        return view;
    }
    private Button button(String text) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextColor(0xff171717);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xffffffff));
        b.setEnabled(!busy);
        return b;
    }
    private LinearLayout.LayoutParams params(int width, int height) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(width, height);
        lp.bottomMargin = dp(8);
        return lp;
    }
    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density + 0.5f); }

    @Override protected void onResume() {
        super.onResume();
        if (state != null && pairingCode != null && !busy) requestState("load", null, pairingCode, false);
    }
    @Override protected void onDestroy() {
        main.removeCallbacks(timerTick);
        io.shutdownNow();
        super.onDestroy();
    }

    private void stopLocationService() {
        stopService(new Intent(this, StaffLocationService.class));
    }

    private void requestGpsPermissions() {
        if (state == null || state.optJSONObject("shift") == null) { fail("Start eerst je werkdag."); return; }
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_PERMISSION);
            return;
        }
        requestNotificationPermissionOrStart();
    }

    private void requestNotificationPermissionOrStart() {
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            pendingNotificationPermission = true;
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, LOCATION_PERMISSION + 1);
            return;
        }
        enableGpsService();
    }

    private void enableGpsService() {
        if (pairingCode == null) return;
        Intent intent = new Intent(this, StaffLocationService.class);
        intent.putExtra("pairing_code", pairingCode);
        if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(intent); else startService(intent);
        Toast.makeText(this, "Locatie delen is gestart. De melding bovenaan blijft zichtbaar.", Toast.LENGTH_LONG).show();
        main.postDelayed(this::render, 700);
    }

    private void disableGps() {
        stopLocationService();
        if (pairingCode == null) return;
        setBusy(true);
        io.execute(() -> {
            try {
                StaffApi.action(this, pairingCode, "clear_position", null, null, null, null);
                JSONObject loaded = StaffApi.action(this, pairingCode, "load", null, null, null, null);
                main.post(() -> { state = loaded; setBusy(false); render(); });
            } catch (Exception e) {
                main.post(() -> { setBusy(false); fail("GPS is gestopt, maar de laatste positie kon niet worden gewist. Controleer de verbinding."); });
            }
        });
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION) {
            boolean fine = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            if (!fine) { Toast.makeText(this, "GPS delen vereist precieze locatietoegang.", Toast.LENGTH_LONG).show(); return; }
            requestNotificationPermissionOrStart();
        } else if (requestCode == LOCATION_PERMISSION + 1 && pendingNotificationPermission) {
            pendingNotificationPermission = false;
            if (android.os.Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                enableGpsService();
            } else {
                Toast.makeText(this, "GPS delen blijft uit zolang de zichtbare melding niet is toegestaan.", Toast.LENGTH_LONG).show();
            }
        }
    }
}
