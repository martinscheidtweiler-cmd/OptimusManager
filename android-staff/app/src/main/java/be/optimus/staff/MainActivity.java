package be.optimus.staff;
import android.Manifest;
import android.app.*;
import android.app.admin.DevicePolicyManager;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.*;
import android.webkit.*;

public class MainActivity extends Activity {
 private static final String HOST="optimus-manager.vercel.app";
 private WebView web;
 private String pendingCode;
 private boolean permittedPage(String url){
  Uri u=Uri.parse(url);
  return "https".equals(u.getScheme()) && HOST.equals(u.getHost()) && ("/staff".equals(u.getPath()) || "/staff/".equals(u.getPath()));
 }
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  web=new WebView(this); setContentView(web);
  web.getSettings().setJavaScriptEnabled(true); web.getSettings().setDomStorageEnabled(true);
  web.getSettings().setAllowFileAccess(false); web.getSettings().setAllowContentAccess(false);
  web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.addJavascriptInterface(new Bridge(),"OptimusNative");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){
    return !permittedPage(r.getUrl().toString());
   }
  });
  web.loadUrl("https://"+HOST+"/staff");
  DevicePolicyManager d=(DevicePolicyManager)getSystemService(DEVICE_POLICY_SERVICE);
  if(d.isDeviceOwnerApp(getPackageName())){
   d.setLockTaskPackages(new ComponentName(this,WorkDeviceAdmin.class),new String[]{getPackageName()});
   startLockTask();
  }
 }
 private boolean hasLocation(){return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;}
 private void startTracking(String code){
  if(!hasLocation()){pendingCode=code;requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},42);return;}
  if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){pendingCode=code;requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},43);return;}
  startForegroundService(new Intent(this,LocationService.class).putExtra("code",code));
 }
 private void report(String status){web.evaluateJavascript("window.dispatchEvent(new CustomEvent('optimus-native-gps',{detail:"+org.json.JSONObject.quote(status)+"}))",null);}
 @Override public void onRequestPermissionsResult(int r,String[] p,int[] g){super.onRequestPermissionsResult(r,p,g);if(r!=42&&r!=43)return;String c=pendingCode;pendingCode=null;if(c!=null&&hasLocation()&&(Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED))startTracking(c);else report("GPS-toestemming geweigerd");}
 public class Bridge {
  @JavascriptInterface public void startGps(String code){runOnUiThread(()->{if(permittedPage(web.getUrl()==null?"":web.getUrl())&&code!=null&&code.matches("[0-9a-f]{64}"))startTracking(code);});}
  @JavascriptInterface public void stopGps(){runOnUiThread(()->{pendingCode=null;stopService(new Intent(MainActivity.this,LocationService.class));});}
 }
}
