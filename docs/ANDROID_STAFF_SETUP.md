# Optimus Tasks — Android setup and release

This guide is for the native app in `android-staff/`. The Android app uses the existing `staff_phone` RPC and shared staff tables. It does not ship a Supabase service-role key. Pairing credentials are encrypted with an Android Keystore key and the app keeps a durable outbox for work actions that have not reached Supabase yet.

## Build and download

The `Optimus Tasks Android build` GitHub Actions workflow builds a debug APK for review. Its artifact is temporary and expires after 14 days. A debug APK is suitable for isolated testing; do not treat it as a final company release because GitHub creates a debug signing key on each runner.

The workflow creates a signed release APK only after these GitHub Actions repository secrets are configured:

- `ANDROID_SIGNING_KEYSTORE_BASE64`
- `ANDROID_SIGNING_STORE_PASSWORD`
- `ANDROID_SIGNING_KEY_ALIAS`
- `ANDROID_SIGNING_KEY_PASSWORD`

Create the signing keystore once with `keytool`, keep a protected offline backup, and store the base64 value and passwords directly in the repository's **Settings → Secrets and variables → Actions**. Never commit the keystore or put its contents in an issue, PR, chat, or build log. Losing this key prevents installing future updates over devices signed with it.

Example keystore creation command (choose a strong unique password and retain the values securely):

```sh
keytool -genkeypair -v -keystore optimus-release.jks -alias optimus-release \
  -keyalg RSA -keysize 4096 -validity 10000
```

On macOS, create the single-line GitHub secret value with:

```sh
base64 -i optimus-release.jks | tr -d '\n'
```

The direct APK installation path is **Settings → Security/Privacy → Install unknown apps**, allow the browser or file manager used to open the APK, then install. Menu names vary by Android manufacturer. The user can switch that permission off again after installation.

## One-time phone pairing

1. In Optimus Manager, open **Personeel → Beheer → Werktelefoons**.
2. Create a unique name for the company phone and generate a pairing code.
3. Enter the code once in Optimus Tasks. The plain code is shown only when created; Supabase stores its SHA-256 hash.
4. Confirm the employee list and contacts appear. Admins can rename or block the phone in the dashboard.

Blocking a phone closes its active task and shift and removes its current location. The app clears its local pairing data when it next reaches the server and learns that the code was revoked. A phone that is offline cannot learn about a revocation until it reconnects.

## Location behavior

Location sharing is off by default and starts only after the employee starts a shift, taps the location control, grants Android location access, and allows the persistent notification. A foreground location service reports one latest position per active shift; the server does not keep a route history. Ending the shift stops location updates and clears the position. A workday with no GPS permission still works for time tracking.

On current Android versions, the service declares the `location` foreground-service type and its permission and starts while the app is visible. Android requires the visible, ongoing notification and limits starting a location service from the background. The service is designed to continue receiving location updates with the screen off while it remains active; OEM battery controls and device-specific behavior still require a physical-phone test. See [Android foreground-service requirements](https://developer.android.com/develop/background-work/services/fgs/service-types) and [location permissions](https://developer.android.com/develop/sensors-and-location/location/permissions).

The app currently provides active-shift tracking only. It does not silently locate an unattended phone after a workday ends. A separate lost-device feature needs an explicit, time-limited admin request plus a tested, visible notification and reliable device wake-up mechanism.

## Kiosk mode and device-owner provisioning

Kiosk mode is deliberately opt-in. Before enabling it, set a device-local administrator code of at least 8 characters from **⋯ → Toestelbeheer**. The app stores only a salted PBKDF2 verifier; the code is not embedded in GitHub. Use the code to enable or exit kiosk mode. The app allowlists itself and the currently selected dialer and messaging apps so the Contact page can open those apps.

For managed dedicated devices, Android's supported setup is Device Owner / Android Enterprise provisioning. A fully managed device is normally provisioned during initial setup; converting an already configured phone commonly requires a factory reset. Android's development-only ADB provisioning can work on eligible, unprovisioned test devices:

```sh
adb install app-release.apk
adb shell dpm set-device-owner be.optimus.staff/.WorkDeviceAdmin
```

Check the manufacturer's current Android Enterprise steps before preparing a company phone. See [dedicated devices](https://developer.android.com/work/dpc/dedicated-devices) and [Lock Task mode](https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode). **No factory reset or provisioning has been performed.** Do not enable kiosk mode on a company phone until the administrator code and recovery route have been tested on a spare device. If the app cannot launch or the code is unavailable, recovery requires an authorized EMM/DPC procedure or a device reset; enabling Device Owner is a device-wide management change.

## Offline behavior

The app caches the last server state and writes begin/task/stop/end events to a local durable queue before attempting synchronization. Each event retains a UUID and its recorded device time across retries. The database migration adds server-side receipts to prevent retries from creating duplicate shifts or task entries. Actions sync in order. A rejected event stays queued and pauses later events instead of silently discarding them. The app marks queued actions separately from the last server sync.

Offline time necessarily uses the company phone's clock until the server receives the event; after synchronization the dashboard uses the supplied event timestamp. Keep device date/time set automatically. The server rejects event times over 5 minutes in the future or older than 31 days.

## Verification still required on a real Android phone

- Install the signed release APK and install a later build over it to verify signing continuity.
- Pair, begin a shift, switch tasks, stop, end, relaunch, and confirm server/dashboard values.
- Repeat those actions offline, relaunch the app, restore connectivity, and confirm one copy of each event.
- Test precise and approximate location, denial, notification denial, screen-off tracking, location services disabled, battery saver, and shift end.
- Test call and SMS handoff on the actual phone model.
- On a spare fully managed test phone, verify Device Owner provisioning, kiosk entry, exit code, reboot recovery, and dialer/SMS allowlisting.
- Verify access to unrelated Optimus Manager tables is denied to an unauthenticated phone.

The build workflow can verify compilation and web-side date calculations. It cannot verify screen-off GPS, OEM battery behavior, Device Owner provisioning, kiosk recovery, or installation on the user's physical phones.

## Security review blocker outside staff tables

The connected Supabase Security Advisor currently reports RLS disabled on `public.horses`, `public.farrier_visits`, `public.medicines`, `public.medicine_issuances`, `public.medicine_usage`, `public.vaccination_records`, `public.vaccination_passport_status`, `public.deworming_records`, `public.horse_xray_records`, and `public.riding_sessions`. This is a separate manager-database issue, but it is relevant before releasing an APK that contains the public Supabase key: an anonymous client may be able to access those tables directly. The staff migrations do not change those tables. Do not ship production phone credentials until these tables have a reviewed, tested RLS policy plan; simply enabling RLS without policies can break the existing manager screens.
