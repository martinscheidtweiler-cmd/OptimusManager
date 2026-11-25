package be.optimus.staff;
import android.Manifest;
import android.app.Activity;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;

public class MainActivity extends Activity {
 private static final String HOST="optimus-manager.vercel.app";
 private WebView web;
 private GeolocationPermissions.Callback pendingPermission;
 private String pendingOrigin;
 private boolean permittedOrigin(String value){
  if(value==null)return false;
  Uri u=Uri.parse(value);
  return "https".equals(u.getScheme())&&HOST.equals(u.getHost())&&(u.getPort()==-1||u.getPort()==443);
 }
 private boolean permittedPage(String url){
  if(!permittedOrigin(url))return false;
  String path=Uri.parse(url).getPath();
  return "/staff".equals(path)||"/staff/".equals(path);
 }
 private boolean hasLocation(){return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;}
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  web=new WebView(this);setContentView(web);
  web.getSettings().setJavaScriptEnabled(true);
  web.getSettings().setDomStorageEnabled(true);
  web.getSettings().setGeolocationEnabled(true);
  web.getSettings().setAllowFileAccess(false);
  web.getSettings().setAllowContentAccess(false);
  web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){
    return !permittedPage(req.getUrl().toString());
   }
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback cb){
    if(!permittedOrigin(origin)||!permittedPage(web.getUrl())){cb.invoke(origin,false,false);return;}
    if(hasLocation()){cb.invoke(origin,true,false);return;}
    if(pendingPermission!=null){pendingPermission.invoke(pendingOrigin,false,false);}
    pendingOrigin=origin;pendingPermission=cb;
    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},42);
   }
  });
  web.loadUrl("https://"+HOST+"/staff");
  DevicePolicyManager d=(DevicePolicyManager)getSystemService(DEVICE_POLICY_SERVICE);
  if(d.isDeviceOwnerApp(getPackageName())){
   d.setLockTaskPackages(new ComponentName(this,WorkDeviceAdmin.class),new String[]{getPackageName()});
   startLockTask();
  }
 }
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] result){
  super.onRequestPermissionsResult(request,permissions,result);
  if(request==42&&pendingPermission!=null){
   pendingPermission.invoke(pendingOrigin,hasLocation()&&permittedPage(web.getUrl()),false);
   pendingPermission=null;pendingOrigin=null;
  }
 }
 @Override protected void onPause(){super.onPause();web.onPause();}
 @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
 @Override protected void onDestroy(){if(pendingPermission!=null)pendingPermission.invoke(pendingOrigin,false,false);if(web!=null)web.destroy();super.onDestroy();}
}
