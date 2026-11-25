package be.optimus.staff;

import android.content.Context;
import android.content.SharedPreferences;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/** Device-local kiosk admin verifier. The code itself is never persisted or shipped in source. */
final class AdminCodeStore {
    private static final String PREFS = "optimus_device_admin";
    private static final String SALT = "salt";
    private static final String HASH = "hash";
    private static final int ITERATIONS = 210_000;
    private static final int KEY_BITS = 256;

    private AdminCodeStore() {}

    static boolean isConfigured(Context context) {
        return prefs(context).contains(SALT) && prefs(context).contains(HASH);
    }

    static boolean save(Context context, char[] code) {
        if (code == null || code.length < 8) return false;
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        byte[] hash = derive(code, salt);
        Arrays.fill(code, '\0');
        if (hash == null) return false;
        return prefs(context).edit()
                .putString(SALT, android.util.Base64.encodeToString(salt, android.util.Base64.NO_WRAP))
                .putString(HASH, android.util.Base64.encodeToString(hash, android.util.Base64.NO_WRAP))
                .putInt("failed", 0).putLong("locked_until", 0).commit();
    }

    static boolean verify(Context context, char[] code) {
        SharedPreferences prefs = prefs(context);
        if (!isConfigured(context) || System.currentTimeMillis() < prefs.getLong("locked_until", 0)) { Arrays.fill(code, '\0'); return false; }
        byte[] actual;
        boolean matches = false;
        try {
            byte[] salt = android.util.Base64.decode(prefs.getString(SALT, ""), android.util.Base64.NO_WRAP);
            byte[] expected = android.util.Base64.decode(prefs.getString(HASH, ""), android.util.Base64.NO_WRAP);
            actual = derive(code, salt);
            matches = actual != null && MessageDigest.isEqual(expected, actual);
        } catch (Exception ignored) { Arrays.fill(code, '\0'); return false; }
        Arrays.fill(code, '\0');
        if (matches) {
            prefs.edit().putInt("failed", 0).putLong("locked_until", 0).commit();
            return true;
        }
        int failed = prefs.getInt("failed", 0) + 1;
        prefs.edit().putInt("failed", failed).putLong("locked_until", failed >= 5 ? System.currentTimeMillis() + 60_000 : 0).commit();
        if (failed >= 5) prefs.edit().putInt("failed", 0).commit();
        return false;
    }

    private static byte[] derive(char[] code, byte[] salt) {
        PBEKeySpec spec = new PBEKeySpec(code, salt, ITERATIONS, KEY_BITS);
        try { return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(); }
        catch (Exception e) { return null; }
        finally { spec.clearPassword(); }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
