package be.optimus.staff;
import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.ActivityManager;
import android.os.SystemClock;
import android.text.InputType;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;
import java.security.MessageDigest;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;

public class MainActivity extends Activity {
 private static final String HOST="optimus-manager.vercel.app";
 private WebView web;
 private Button kioskButton;
 private int failedAttempts=0;
 private long lockedUntil=0;
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
  LinearLayout root=new LinearLayout(this);
  root.setOrientation(LinearLayout.VERTICAL);
  kioskButton=new Button(this);
  kioskButton.setAllCaps(false);
  kioskButton.setOnClickListener(v->manageKiosk());
  root.addView(kioskButton,new LinearLayout.LayoutParams(-1,-2));
  web=new WebView(this);
  root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
  setContentView(root);
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
  updateKioskButton();
 }
 private boolean isLocked(){
  ActivityManager manager=(ActivityManager)getSystemService(ACTIVITY_SERVICE);
  return manager.getLockTaskModeState()!=ActivityManager.LOCK_TASK_MODE_NONE;
 }
 private boolean managed(){
  return ((DevicePolicyManager)getSystemService(DEVICE_POLICY_SERVICE)).isDeviceOwnerApp(getPackageName());
 }
 private void updateKioskButton(){
  kioskButton.setText(isLocked()?"Beheer · kiosk verlaten":"Beheer · kiosk inschakelen");
 }
 private static byte[] hex(String value){
  byte[] out=new byte[value.length()/2];
  for(int i=0;i<out.length;i++)out[i]=(byte)Integer.parseInt(value.substring(i*2,i*2+2),16);
  return out;
 }
 private boolean verifyCode(char[] code){
  PBEKeySpec spec=new PBEKeySpec(code,hex("632d5cd625a8028b9ea5423ce3d8d6d8"),210000,256);
  try{
   byte[] actual=SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
   return MessageDigest.isEqual(actual,hex("f5177ae37d75c598c503206f8e1a576db39fcea04999e69076965c6c30fd78c2"));
  }catch(Exception e){return false;}finally{spec.clearPassword();java.util.Arrays.fill(code,'\0');}
 }
 private void manageKiosk(){
  if(!managed()){Toast.makeText(this,"Kiosk vereist een beheerd werktoestel.",Toast.LENGTH_LONG).show();return;}
  if(!isLocked()){
   startLockTask();updateKioskButton();return;
  }
  if(SystemClock.elapsedRealtime()<lockedUntil){Toast.makeText(this,"Te veel pogingen. Probeer over 60 seconden opnieuw.",Toast.LENGTH_LONG).show();return;}
  EditText input=new EditText(this);
  input.setSingleLine(true);
  input.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
  new AlertDialog.Builder(this).setTitle("Kioskmodus verlaten").setMessage("Geef de beheerderscode in.").setView(input)
   .setNegativeButton("Annuleren",null)
   .setPositiveButton("Ontgrendelen",(dialog,which)->{
    char[] entered=input.getText().toString().toCharArray();input.getText().clear();
    if(verifyCode(entered)){
     failedAttempts=0;lockedUntil=0;stopLockTask();updateKioskButton();
    }else{
     failedAttempts++;
     if(failedAttempts>=5){failedAttempts=0;lockedUntil=SystemClock.elapsedRealtime()+60000;}
     Toast.makeText(this,"Onjuiste beheerderscode.",Toast.LENGTH_SHORT).show();
    }
   }).show();
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
