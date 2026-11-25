plugins { id("com.android.application") }
val releaseKeystore = System.getenv("ANDROID_SIGNING_STORE_FILE")
val releaseStorePassword = System.getenv("ANDROID_SIGNING_STORE_PASSWORD")
val releaseKeyAlias = System.getenv("ANDROID_SIGNING_KEY_ALIAS")
val releaseKeyPassword = System.getenv("ANDROID_SIGNING_KEY_PASSWORD")
android {
 namespace = "be.optimus.staff"
 compileSdk = 35
 defaultConfig {
  applicationId = "be.optimus.staff"
  minSdk = 26
  targetSdk = 35
  versionCode = 1
  versionName = "1.0"
 }
 signingConfigs {
  create("companyRelease") {
   if (!releaseKeystore.isNullOrBlank()) storeFile = file(releaseKeystore)
   storePassword = releaseStorePassword
   keyAlias = releaseKeyAlias
   keyPassword = releaseKeyPassword
  }
 }
 buildTypes {
  getByName("release") {
   isMinifyEnabled = false
   signingConfig = signingConfigs.getByName("companyRelease")
  }
 }
}
