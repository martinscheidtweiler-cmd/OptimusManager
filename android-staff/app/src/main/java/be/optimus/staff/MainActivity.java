package be.optimus.staff;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.UserManager;
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
import java.io.IOException;
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
    private String language = "nl";
    private TextView timerView;
    private String timerStart;
    private volatile long lastServerSync;

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
        language = getSharedPreferences("optimus_preferences", MODE_PRIVATE).getString("language", "nl");
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
                    state = StaffOfflineStore.loadState(this);
                    lastServerSync = StaffOfflineStore.lastSyncedAt(this);
                    if (saved == null || saved.isEmpty()) { setBusy(false); render(); }
                    else {
                        JSONArray pending = StaffOfflineStore.pending(this);
                        state = optimisticState(state, pending);
                        setBusy(false);
                        render();
                        requestState("load", null, saved, true);
                    }
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
                final JSONObject result = response;
                main.post(() -> {
                    state = result;
                    StaffOfflineStore.saveState(this, result);
                    lastServerSync = System.currentTimeMillis();
                    error = "";
                    if ("end".equals(action)) { selectedLocation = null; showContacts = false; stopLocationService(); }
                    if ("load".equals(action)) restoreLocationService(result);
                    setBusy(false);
                    render();
                    if ("load".equals(action) && StaffOfflineStore.pending(this).length() > 0) flushPending();
                    else if ("load".equals(action)) ensureKioskGps();
                });
            } catch (Exception e) {
                main.post(() -> {
                    setBusy(false);
                    String message = e.getMessage() == null ? "" : e.getMessage();
                    if (message.toLowerCase(Locale.ROOT).contains("device not authorized")) {
                        DeviceSecretStore.clear(this);
                        StaffOfflineStore.clear(this);
                        pairingCode = null;
                        state = null;
                        fail("Deze werktelefoon is geblokkeerd. Vraag een beheerder om opnieuw te koppelen.");
                        return;
                    }
                    JSONObject cached = StaffOfflineStore.loadState(this);
                    if (cached != null) {
                        state = optimisticState(cached, StaffOfflineStore.pending(this));
                        fail("Offline · laatste synchronisatie " + syncAge() + ". Nog niet gesynchroniseerd: " + StaffOfflineStore.pending(this).length());
                    } else {
                        fail(e.getMessage() == null ? "Geen verbinding met Optimus Tasks." : e.getMessage());
                    }
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
                main.post(() -> { pairingCode = value; state = result; StaffOfflineStore.saveState(this, result); lastServerSync = System.currentTimeMillis(); error = ""; setBusy(false); render(); });
            } catch (Exception e) {
                main.post(() -> { setBusy(false); fail("Koppelcode ongeldig of ingetrokken. Controleer internet en probeer opnieuw."); });
            }
        });
    }

    private void change(String action, Long target) {
        if (busy || pairingCode == null) return;
        if (state == null) { fail("Er is nog geen gesynchroniseerde takenlijst op dit toestel."); return; }
        setBusy(true);
        long eventTime = System.currentTimeMillis();
        render();
        io.execute(() -> {
            try {
                StaffOfflineStore.enqueue(this, action, target, eventTime);
                main.post(() -> {
                    state = optimisticState(StaffOfflineStore.loadState(this), StaffOfflineStore.pending(this));
                    if ("end".equals(action)) { selectedLocation = null; showContacts = false; stopLocationService(); }
                    render();
                });
                flushPendingOnIo();
            } catch (Exception e) {
                main.post(() -> { setBusy(false); fail(e.getMessage() == null ? "Actie kon niet veilig opgeslagen worden." : e.getMessage()); });
            }
        });
    }

    private void flushPending() {
        if (busy || pairingCode == null || StaffOfflineStore.pending(this).length() == 0) return;
        setBusy(true);
        render();
        io.execute(this::flushPendingOnIo);
    }

    private void flushPendingOnIo() {
        try {
            while (true) {
                JSONArray queue = StaffOfflineStore.pending(this);
                if (queue.length() == 0) break;
                JSONObject event = queue.optJSONObject(0);
                if (event == null) break;
                String id = event.optString("id");
                JSONObject result = StaffApi.action(this, pairingCode, event.optString("action"),
                        event.has("target") ? event.optLong("target") : null,
                        null, null, null, id, event.optString("occurred_at"));
                StaffOfflineStore.remove(this, id);
                StaffOfflineStore.saveState(this, result);
                lastServerSync = System.currentTimeMillis();
                main.post(() -> {
                    state = optimisticState(result, StaffOfflineStore.pending(this));
                    error = StaffOfflineStore.pending(this).length() == 0 ? "" : "Synchroniseren…";
                    render();
                });
            }
            main.post(() -> { setBusy(false); state = StaffOfflineStore.loadState(this); error = ""; render(); ensureKioskGps(); });
        } catch (IOException networkError) {
            main.post(() -> {
                setBusy(false);
                JSONObject cached = StaffOfflineStore.loadState(this);
                if (cached != null) state = optimisticState(cached, StaffOfflineStore.pending(this));
                error = "Offline · " + StaffOfflineStore.pending(this).length() + " actie(s) wachten op synchronisatie. Laat de app open of probeer later opnieuw.";
                render();
            });
        } catch (Exception actionError) {
            main.post(() -> {
                setBusy(false);
                String message = actionError.getMessage() == null ? "" : actionError.getMessage();
                if (message.toLowerCase(Locale.ROOT).contains("device not authorized")) {
                    DeviceSecretStore.clear(this);
                    StaffOfflineStore.clear(this);
                    pairingCode = null;
                    state = null;
                    fail("Deze werktelefoon is geblokkeerd. Vraag een beheerder om opnieuw te koppelen.");
                    return;
                }
                JSONObject cached = StaffOfflineStore.loadState(this);
                if (cached != null) state = optimisticState(cached, StaffOfflineStore.pending(this));
                error = "Synchronisatie gepauzeerd: " + (actionError.getMessage() == null ? "actie geweigerd" : actionError.getMessage()) + ". Volgende taken blijven bewaard.";
                render();
            });
        }
    }

    private JSONObject optimisticState(JSONObject base, JSONArray queue) {
        if (base == null) return null;
        JSONObject view;
        try { view = new JSONObject(base.toString()); } catch (Exception e) { return base; }
        for (int i = 0; i < queue.length(); i++) {
            JSONObject event = queue.optJSONObject(i);
            if (event == null) continue;
            String action = event.optString("action");
            String time = event.optString("occurred_at");
            try {
                JSONObject shift = view.optJSONObject("shift");
                JSONObject entry = view.optJSONObject("entry");
                if ("begin".equals(action) && shift == null) {
                    JSONObject worker = null;
                    JSONArray workers = view.optJSONArray("workers");
                    for (int j = 0; workers != null && j < workers.length(); j++) if (workers.optJSONObject(j).optLong("id") == event.optLong("target")) worker = workers.optJSONObject(j);
                    if (worker != null) {
                        JSONObject localShift = new JSONObject(); localShift.put("id", "pending"); localShift.put("worker_id", worker.optLong("id")); localShift.put("started_at", time); view.put("shift", localShift);
                    }
                } else if (shift != null && "task".equals(action)) {
                    if (entry != null) entry.put("ended_at", time);
                    JSONObject newEntry = new JSONObject(); newEntry.put("id", "pending-" + event.optString("id")); newEntry.put("shift_id", shift.optString("id")); newEntry.put("task_id", event.optLong("target")); newEntry.put("started_at", time); view.put("entry", newEntry);
                } else if (shift != null && "stop".equals(action)) {
                    if (entry != null) entry.put("ended_at", time);
                    view.put("entry", JSONObject.NULL);
                } else if (shift != null && "end".equals(action)) {
                    if (entry != null) entry.put("ended_at", time);
                    view.put("entry", JSONObject.NULL); view.put("shift", JSONObject.NULL);
                }
            } catch (Exception ignored) {}
        }
        return view;
    }

    private String syncAge() {
        return syncAge(lastServerSync);
    }

    private String syncAge(long syncedAt) {
        if (syncedAt <= 0) return "onbekend";
        long minutes = Math.max(0, (System.currentTimeMillis() - syncedAt) / 60000);
        return minutes == 0 ? "minder dan een minuut geleden" : minutes + " min geleden";
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
        LinearLayout topRow = new LinearLayout(this);
        topRow.setGravity(Gravity.CENTER_VERTICAL);
        TextView top = label(shift == null ? "Optimus Tasks" : workerName(shift.optLong("worker_id")), 15, true);
        topRow.addView(top, new LinearLayout.LayoutParams(0, dp(38), 1f));
        Button languageButton = button(language.toUpperCase(Locale.ROOT));
        languageButton.setContentDescription(tr("Taal wijzigen", "Change language", "Changer la langue"));
        languageButton.setOnClickListener(v -> cycleLanguage());
        topRow.addView(languageButton, new LinearLayout.LayoutParams(dp(52), dp(42)));
        Button admin = button("⋯");
        admin.setContentDescription("Beheeropties");
        admin.setOnClickListener(v -> showAdminMenu());
        topRow.addView(admin, new LinearLayout.LayoutParams(dp(48), dp(42)));
        root.addView(topRow, params(-1, dp(42)));
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
        TextView sync = label(tr("Verbinding · ", "Connection · ", "Connexion · ")
                + (lastServerSync == 0 ? tr("status wordt gecontroleerd", "checking status", "vérification du statut") : tr("bijgewerkt ", "updated ", "mis à jour ") + syncAge())
                + (StaffOfflineStore.pending(this).length() > 0 ? tr(" · wachtrij ", " · queued ", " · en attente ") + StaffOfflineStore.pending(this).length() : ""), 11, false);
        sync.setTextColor(0xff666666);
        root.addView(sync, params(-1, dp(25)));
        if (StaffOfflineStore.pending(this).length() > 0) {
            Button synchronize = button(tr("Wachtende acties synchroniseren", "Synchronize queued actions", "Synchroniser les actions en attente"));
            synchronize.setOnClickListener(v -> requestState("load", null, pairingCode, false));
            root.addView(synchronize, params(-1, dp(44)));
        }
        if (shift == null) { renderWorkerSelection(); return; }
        renderWorkday(shift);
    }

    private void renderPairing() {
        root.addView(label(tr("Werktelefoon koppelen", "Pair work phone", "Associer le téléphone"), 19, true), params(-1, dp(52)));
        root.addView(label(tr("Maak een eenmalige koppelcode in Optimus Manager → Personeel → Beheer.", "Create a one-time pairing code in Optimus Manager → Staff → Manage.", "Créez un code de jumelage unique dans Optimus Manager → Personnel → Gestion."), 14, false));
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setHint(tr("Koppelcode", "Pairing code", "Code de jumelage"));
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        input.setAutofillHints();
        root.addView(input, params(-1, dp(54)));
        Button submit = button(tr("Telefoon koppelen", "Pair phone", "Associer le téléphone"));
        submit.setOnClickListener(v -> pair(input.getText().toString()));
        root.addView(submit, params(-1, dp(52)));
    }

    private void renderWorkerSelection() {
        root.addView(label(tr("Wie ben je vandaag?", "Who are you today?", "Qui êtes-vous aujourd'hui ?"), 19, true), params(-1, dp(54)));
        root.addView(label(tr("Kies je naam om je werkdag te starten.", "Choose your name to start your workday.", "Choisissez votre nom pour commencer votre journée."), 14, false));
        JSONArray workers = state == null ? new JSONArray() : state.optJSONArray("workers");
        if (workers == null || workers.length() == 0) root.addView(label(tr("Er zijn geen actieve medewerkers ingesteld.", "No active employees are configured.", "Aucun membre du personnel actif n'est configuré."), 14, false));
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
        root.addView(label(tr("HUIDIGE TAAK", "CURRENT TASK", "TÂCHE EN COURS"), 11, false), params(-1, dp(28)));
        root.addView(label(entry == null ? tr("Geen actieve taak", "No active task", "Aucune tâche active") : taskName + " · " + location, 18, true), params(-1, dp(44)));
        TextView clock = label(entry == null ? "00:00:00" : elapsed(entry.optString("started_at")), 40, true);
        clock.setTypeface(android.graphics.Typeface.MONOSPACE, android.graphics.Typeface.BOLD);
        timerView = clock;
        timerStart = entry == null ? null : entry.optString("started_at", null);
        root.addView(clock, params(-1, dp(64)));
        if (entry != null) {
            Button stop = button(tr("Stop taak", "Stop task", "Arrêter la tâche"));
            stop.setOnClickListener(v -> change("stop", null));
            root.addView(stop, params(-1, dp(50)));
        }

        boolean sharing = getSharedPreferences("optimus_gps_state", MODE_PRIVATE).getBoolean("active", false);
        long lastPosition = getSharedPreferences("optimus_gps_state", MODE_PRIVATE).getLong("last_position_at", 0);
        String gpsStatus = sharing ? (lastPosition > 0 ? tr("actief · bijgewerkt ", "active · updated ", "actif · mis à jour ") + syncAge(lastPosition) : tr("actief · positie zoeken", "active · finding position", "actif · recherche de position")) : tr("uit", "off", "désactivé");
        TextView gps = label("GPS · " + gpsStatus, 12, false);
        gps.setTextColor(0xff666666);
        root.addView(gps, params(-1, dp(36)));
        if (sharing && inLockTask()) {
            root.addView(label(tr("Locatie delen stopt automatisch wanneer je je werkdag beëindigt.", "Location sharing stops automatically when you end your workday.", "Le partage de position s'arrête automatiquement à la fin de votre journée."), 12, false), params(-1, dp(38)));
        } else {
            Button gpsToggle = button(sharing ? tr("Locatie delen stoppen", "Stop location sharing", "Arrêter le partage de position") : tr("Locatie delen inschakelen", "Enable location sharing", "Activer le partage de position"));
            gpsToggle.setOnClickListener(v -> { if (sharing) disableGps(); else requestGpsPermissions(); });
            root.addView(gpsToggle, params(-1, dp(46)));
        }

        if (showContacts) { renderContacts(); return; }
        if (selectedLocation != null) { renderTasksForLocation(selectedLocation); return; }
        root.addView(label(tr("Taken per locatie", "Tasks by location", "Tâches par lieu"), 17, true), params(-1, dp(48)));
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
        Button contacts = button(tr("Contact", "Contacts", "Contacts"));
        contacts.setOnClickListener(v -> { showContacts = true; render(); });
        root.addView(contacts, params(-1, dp(50)));
        Button end = button(tr("Werkdag beëindigen", "End workday", "Terminer la journée"));
        end.setOnClickListener(v -> new AlertDialog.Builder(this).setMessage(tr("Werkdag beëindigen?", "End this workday?", "Terminer cette journée ?"))
                .setNegativeButton(tr("Annuleren", "Cancel", "Annuler"), null).setPositiveButton(tr("Beëindigen", "End", "Terminer"), (d, w) -> change("end", null)).show());
        root.addView(end, params(-1, dp(50)));
    }

    private void renderTasksForLocation(long locationId) {
        Button back = button(tr("← Locaties", "← Locations", "← Lieux"));
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
        Button back = button(tr("← Terug", "← Back", "← Retour"));
        back.setOnClickListener(v -> { showContacts = false; render(); });
        root.addView(back, params(-1, dp(46)));
        root.addView(label(tr("Contact", "Contacts", "Contacts"), 18, true), params(-1, dp(48)));
        JSONArray contacts = state.optJSONArray("contacts");
        for (int i = 0; contacts != null && i < contacts.length(); i++) {
            JSONObject item = contacts.optJSONObject(i);
            if (item == null) continue;
            String name = item.optString("name", "Contact");
            String phone = item.optString("phone", "").trim();
            root.addView(label(name, 16, true), params(-1, dp(38)));
            if (phone.isEmpty() || "null".equals(phone)) {
                root.addView(label(tr("Telefoonnummer nog niet ingesteld", "Phone number not set", "Numéro de téléphone non défini"), 13, false));
            } else {
                LinearLayout row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                Button call = button(tr("Bellen", "Call", "Appeler"));
                call.setOnClickListener(v -> startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(phone)))));
                Button sms = button(tr("Bericht", "Message", "Message"));
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

    private String tr(String dutch, String english, String french) {
        if ("fr".equals(language)) return french;
        if ("en".equals(language)) return english;
        return dutch;
    }

    private void cycleLanguage() {
        language = "nl".equals(language) ? "en" : "en".equals(language) ? "fr" : "nl";
        getSharedPreferences("optimus_preferences", MODE_PRIVATE).edit().putString("language", language).apply();
        render();
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

    private void restoreLocationService(JSONObject serverState) {
        JSONObject device = serverState == null ? null : serverState.optJSONObject("device");
        boolean enabled = device != null && device.optBoolean("gps_enabled", false)
                && serverState.optJSONObject("shift") != null;
        if (!enabled) {
            stopLocationService();
            getSharedPreferences("optimus_gps_state", MODE_PRIVATE).edit().putBoolean("active", false).apply();
            return;
        }
        boolean locationAllowed = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean notificationAllowed = android.os.Build.VERSION.SDK_INT < 33
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        boolean canRun = locationAllowed && notificationAllowed;
        getSharedPreferences("optimus_gps_state", MODE_PRIVATE).edit().putBoolean("active", canRun).apply();
        if (!StaffLocationService.running && canRun) startLocationService();
        if (!canRun) error = "GPS-deling wacht op toegestane locatie en zichtbare melding op dit toestel.";
    }

    private void startLocationService() {
        if (pairingCode == null) return;
        Intent intent = new Intent(this, StaffLocationService.class);
        intent.putExtra("pairing_code", pairingCode);
        if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(intent); else startService(intent);
    }

    private boolean isDeviceOwner() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(DEVICE_POLICY_SERVICE);
        return dpm != null && dpm.isDeviceOwnerApp(getPackageName());
    }

    private boolean inLockTask() {
        ActivityManager manager = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        return manager != null && manager.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    private void ensureKioskGps() {
        if (!isDeviceOwner() || !inLockTask() || busy || state == null || pairingCode == null
                || state.optJSONObject("shift") == null) return;
        JSONObject device = state.optJSONObject("device");
        boolean serverEnabled = device != null && device.optBoolean("gps_enabled", false);
        if (serverEnabled) {
            if (!StaffLocationService.running) startLocationService();
            return;
        }
        main.post(this::requestGpsPermissions);
    }

    private void showAdminMenu() {
        String kioskAction = inLockTask() ? tr("Kioskmodus verlaten", "Exit kiosk mode", "Quitter le mode kiosque") : tr("Kioskmodus inschakelen", "Enable kiosk mode", "Activer le mode kiosque");
        String codeAction = AdminCodeStore.isConfigured(this) ? tr("Beheerderscode wijzigen", "Change admin code", "Modifier le code admin") : tr("Beheerderscode instellen", "Set admin code", "Définir le code admin");
        new AlertDialog.Builder(this)
                .setTitle(tr("Toestelbeheer", "Device management", "Gestion de l'appareil"))
                .setItems(new String[]{kioskAction, codeAction}, (dialog, which) -> {
                    if (which == 0) requestAdminCode(inLockTask() ? tr("Kioskmodus verlaten", "Exit kiosk mode", "Quitter le mode kiosque") : tr("Kioskmodus inschakelen", "Enable kiosk mode", "Activer le mode kiosque"), () -> toggleKiosk());
                    else changeAdminCode();
                }).setNegativeButton(tr("Sluiten", "Close", "Fermer"), null).show();
    }

    private void requestAdminCode(String title, Runnable success) {
        if (!AdminCodeStore.isConfigured(this)) {
            fail(tr("Stel eerst een beheerderscode van minstens 8 tekens in.", "Set an admin code with at least 8 characters first.", "Définissez d'abord un code admin d'au moins 8 caractères."));
            changeAdminCode();
            return;
        }
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        new AlertDialog.Builder(this).setTitle(title).setMessage(tr("Beheerderscode", "Admin code", "Code admin"))
                .setView(input).setNegativeButton(tr("Annuleren", "Cancel", "Annuler"), null)
                .setPositiveButton(tr("Doorgaan", "Continue", "Continuer"), (d, w) -> {
                    if (AdminCodeStore.verify(this, input.getText().toString().toCharArray())) success.run();
                    else Toast.makeText(this, tr("Code onjuist of tijdelijk geblokkeerd.", "Code incorrect or temporarily locked.", "Code incorrect ou temporairement bloqué."), Toast.LENGTH_LONG).show();
                }).show();
    }

    private void changeAdminCode() {
        Runnable enterNewCode = () -> {
            EditText input = new EditText(this);
            input.setSingleLine(true);
            input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
            input.setHint(tr("Minstens 8 tekens", "At least 8 characters", "Au moins 8 caractères"));
            new AlertDialog.Builder(this).setTitle(tr("Nieuwe beheerderscode", "New admin code", "Nouveau code admin")).setMessage(tr("Kies een code die alleen beheerders kennen.", "Choose a code known only to administrators.", "Choisissez un code connu uniquement des administrateurs."))
                    .setView(input).setNegativeButton(tr("Annuleren", "Cancel", "Annuler"), null)
                    .setPositiveButton(tr("Opslaan", "Save", "Enregistrer"), (d, w) -> {
                        char[] value = input.getText().toString().toCharArray();
                        if (AdminCodeStore.save(this, value)) Toast.makeText(this, tr("Beheerderscode ingesteld op dit toestel.", "Admin code set on this device.", "Code admin défini sur cet appareil."), Toast.LENGTH_LONG).show();
                        else Toast.makeText(this, tr("Gebruik minstens 8 tekens en probeer opnieuw.", "Use at least 8 characters and try again.", "Utilisez au moins 8 caractères et réessayez."), Toast.LENGTH_LONG).show();
                    }).show();
        };
        if (AdminCodeStore.isConfigured(this)) requestAdminCode(tr("Beheerderscode wijzigen", "Change admin code", "Modifier le code admin"), enterNewCode);
        else enterNewCode.run();
    }

    private void toggleKiosk() {
        if (!isDeviceOwner()) {
            fail(tr("Kioskmodus vereist eenmalige Android Device Owner-provisioning. Raadpleeg de installatiehandleiding.", "Kiosk mode requires Android Device Owner provisioning. See the setup guide.", "Le mode kiosque nécessite le provisionnement Android Device Owner. Consultez le guide."));
            return;
        }
        if (android.os.Build.VERSION.SDK_INT < 28) {
            fail(tr("Kioskmodus vereist Android 9 of nieuwer.", "Kiosk mode requires Android 9 or newer.", "Le mode kiosque nécessite Android 9 ou une version ultérieure."));
            return;
        }
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(this, WorkDeviceAdmin.class);
        if (inLockTask()) {
            dpm.clearPackagePersistentPreferredActivities(admin, getPackageName());
            stopLockTask();
            dpm.clearUserRestriction(admin, UserManager.DISALLOW_CONFIG_LOCATION);
            dpm.setLockTaskPackages(admin, new String[0]);
            Toast.makeText(this, tr("Kioskmodus verlaten.", "Kiosk mode exited.", "Mode kiosque désactivé."), Toast.LENGTH_SHORT).show();
            return;
        }
        dpm.addUserRestriction(admin, UserManager.DISALLOW_CONFIG_LOCATION);
        if (android.os.Build.VERSION.SDK_INT >= 30) dpm.setLocationEnabled(admin, true);
        boolean fineGranted = dpm.setPermissionGrantState(admin, getPackageName(), Manifest.permission.ACCESS_FINE_LOCATION,
                DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED)
                && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarseGranted = dpm.setPermissionGrantState(admin, getPackageName(), Manifest.permission.ACCESS_COARSE_LOCATION,
                DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED)
                && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean notificationsGranted = true;
        if (android.os.Build.VERSION.SDK_INT >= 33)
            notificationsGranted = dpm.setPermissionGrantState(admin, getPackageName(), Manifest.permission.POST_NOTIFICATIONS,
                    DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED)
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        if ((!fineGranted && !coarseGranted) || !notificationsGranted) {
            dpm.clearUserRestriction(admin, UserManager.DISALLOW_CONFIG_LOCATION);
            fail(tr("Android kon GPS- of meldingsmachtiging niet beheren. Kioskmodus is niet ingeschakeld.", "Android could not manage location or notification permissions. Kiosk mode was not enabled.", "Android n'a pas pu gérer les autorisations de localisation ou de notification. Le mode kiosque n'a pas été activé."));
            return;
        }
        java.util.ArrayList<String> packages = new java.util.ArrayList<>();
        packages.add(getPackageName());
        addResolvedPackage(packages, new Intent(Intent.ACTION_DIAL, Uri.parse("tel:")));
        addResolvedPackage(packages, new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:")));
        dpm.setLockTaskPackages(admin, packages.toArray(new String[0]));
        IntentFilter home = new IntentFilter(Intent.ACTION_MAIN);
        home.addCategory(Intent.CATEGORY_HOME);
        home.addCategory(Intent.CATEGORY_DEFAULT);
        dpm.addPersistentPreferredActivity(admin, home, new ComponentName(this, MainActivity.class));
        dpm.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_HOME
                | DevicePolicyManager.LOCK_TASK_FEATURE_NOTIFICATIONS);
        startLockTask();
        Toast.makeText(this, tr("Kioskmodus ingeschakeld.", "Kiosk mode enabled.", "Mode kiosque activé."), Toast.LENGTH_SHORT).show();
        main.post(this::ensureKioskGps);
    }

    private void addResolvedPackage(java.util.List<String> packages, Intent intent) {
        android.content.pm.ResolveInfo info = getPackageManager().resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY);
        if (info != null && info.activityInfo != null && !packages.contains(info.activityInfo.packageName)) packages.add(info.activityInfo.packageName);
    }

    private void requestGpsPermissions() {
        if (StaffOfflineStore.pending(this).length() > 0) { fail("Synchroniseer eerst de wachtende werkdagacties voordat GPS kan starten."); return; }
        if (state == null || state.optJSONObject("shift") == null) { fail("Start eerst je werkdag."); return; }
        boolean hasFine = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean hasCoarse = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!hasFine && !hasCoarse) {
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
        setBusy(true);
        render();
        io.execute(() -> {
            try {
                JSONObject updated = StaffApi.action(this, pairingCode, "gps_start", null, null, null, null);
                main.post(() -> {
                    state = updated;
                    StaffOfflineStore.saveState(this, updated);
                    setBusy(false);
                    startLocationService();
                    Toast.makeText(this, "Locatie delen is gestart. De melding bovenaan blijft zichtbaar.", Toast.LENGTH_LONG).show();
                    render();
                });
            } catch (Exception e) {
                main.post(() -> { setBusy(false); fail("GPS kon niet starten. Controleer verbinding en werkdag."); });
            }
        });
    }

    private void disableGps() {
        getSharedPreferences("optimus_gps_state", MODE_PRIVATE).edit().putBoolean("active", false).apply();
        stopLocationService();
        if (pairingCode == null) return;
        setBusy(true);
        io.execute(() -> {
            try {
                JSONObject loaded = StaffApi.action(this, pairingCode, "gps_stop", null, null, null, null);
                main.post(() -> { state = loaded; setBusy(false); render(); });
            } catch (Exception e) {
                main.post(() -> { setBusy(false); fail("GPS is gestopt, maar de laatste positie kon niet worden gewist. Controleer de verbinding."); });
            }
        });
    }

    @Override public void onBackPressed() {
        if (showContacts) { showContacts = false; render(); return; }
        if (selectedLocation != null) { selectedLocation = null; render(); return; }
        if (inLockTask()) {
            Toast.makeText(this, tr("De kioskmodus is actief.", "Kiosk mode is active.", "Le mode kiosque est actif."), Toast.LENGTH_SHORT).show();
            return;
        }
        super.onBackPressed();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION) {
            boolean fine = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            boolean coarse = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            if (!fine && !coarse) { Toast.makeText(this, "Locatietoegang werd niet toegestaan.", Toast.LENGTH_LONG).show(); return; }
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
