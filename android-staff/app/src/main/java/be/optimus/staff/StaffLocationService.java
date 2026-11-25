package be.optimus.staff;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Visible foreground service for optional live location during a registered workday. */
public class StaffLocationService extends Service implements LocationListener {
    private static final String CHANNEL = "optimus_staff_location";
    private static final int NOTIFICATION_ID = 2301;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private LocationManager manager;
    private String code;

    @Override public void onCreate() {
        super.onCreate();
        manager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        createNotificationChannel();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            code = intent == null ? DeviceSecretStore.read(this) : intent.getStringExtra("pairing_code");
        } catch (Exception ignored) { code = null; }
        if (code == null || code.isEmpty()) { stopSelf(); return START_NOT_STICKY; }
        startVisibleForeground();
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopSelf(); return START_NOT_STICKY;
        }
        try {
            if (manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 30000L, 35f, this, Looper.getMainLooper());
                Location last = manager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (last != null && System.currentTimeMillis() - last.getTime() < 120000L) onLocationChanged(last);
            } else {
                stopSelf();
            }
        } catch (SecurityException e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        getSharedPreferences("optimus_gps_state", MODE_PRIVATE).edit().putBoolean("active", true).apply();
        return START_STICKY;
    }

    private void startVisibleForeground() {
        Notification notification = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("Optimus Tasks")
                .setContentText("Locatie delen is actief tijdens de werkdag")
                .setOngoing(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Optimus Tasks locatie", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Zichtbare melding wanneer de werktelefoon tijdens een werkdag locatie deelt.");
        NotificationManager notifications = getSystemService(NotificationManager.class);
        if (notifications != null) notifications.createNotificationChannel(channel);
    }

    @Override public void onLocationChanged(Location location) {
        if (code == null || location == null) return;
        String credential = code;
        double lat = location.getLatitude();
        double lon = location.getLongitude();
        double accuracy = location.hasAccuracy() ? location.getAccuracy() : 0;
        io.execute(() -> {
            try { StaffApi.action(this, credential, "position", null, lat, lon, accuracy); }
            catch (Exception ignored) { /* The dashboard will show the last sync time as stale. */ }
        });
    }

    @Override public void onProviderDisabled(String provider) { stopSelf(); }
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, android.os.Bundle extras) {}

    @Override public void onDestroy() {
        if (manager != null) manager.removeUpdates(this);
        getSharedPreferences("optimus_gps_state", MODE_PRIVATE).edit().putBoolean("active", false).apply();
        io.shutdownNow();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
