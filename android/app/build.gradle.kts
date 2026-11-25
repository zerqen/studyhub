import java.io.File
import java.util.Properties

plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.compose.compiler)
  alias(libs.plugins.kotlin.serialization)
}

val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
  if (keystorePropsFile.exists()) {
    keystorePropsFile.inputStream().use { load(it) }
  }
}

android {
  namespace = "ru.studyhub.app"
  compileSdk = 36
  defaultConfig {
    applicationId = "ru.studyhub.app"
    minSdk = 26
    targetSdk = 36
    versionCode = 6
    versionName = "1.4.1"
  }

  signingConfigs {
    create("release") {
      val ksPath = System.getenv("ANDROID_KEYSTORE_PATH")
        ?: keystoreProps.getProperty("storeFile")
      val ksFile = ksPath?.let { path ->
        val f = File(path)
        if (f.isAbsolute) f else rootProject.file(path)
      }
      if (ksFile != null && ksFile.exists()) {
        storeFile = ksFile
        storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
          ?: keystoreProps.getProperty("storePassword")
        keyAlias = System.getenv("ANDROID_KEY_ALIAS")
          ?: keystoreProps.getProperty("keyAlias")
        keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
          ?: keystoreProps.getProperty("keyPassword")
      }
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = true
      isShrinkResources = true
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
      val relConfig = signingConfigs.getByName("release")
      if (relConfig.storeFile != null) {
        signingConfig = relConfig
      }
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  buildFeatures {
    compose = true
    aidl = false
    buildConfig = false
    shaders = false
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }
}

kotlin {
  jvmToolchain(17)
}

dependencies {
  val composeBom = platform(libs.androidx.compose.bom)
  implementation(composeBom)
  androidTestImplementation(composeBom)

  // Core Android
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.lifecycle.runtime.ktx)
  implementation(libs.androidx.activity.compose)
  implementation(libs.kotlinx.coroutines.android)

  // Lifecycle & ViewModel
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.viewmodel.compose)

  // Compose Material 3
  implementation(libs.androidx.compose.ui)
  implementation(libs.androidx.compose.ui.tooling.preview)
  implementation(libs.androidx.compose.material3)
  implementation(libs.androidx.compose.material.icons)

  // Networking, Serialization, Persistence, Sync
  implementation(libs.kotlinx.serialization.json)
  implementation(libs.okhttp)
  implementation(libs.androidx.datastore.preferences)
  implementation(libs.androidx.work.runtime.ktx)

  // Home Screen Widget (Jetpack Glance)
  implementation(libs.androidx.glance.appwidget)
  implementation(libs.androidx.glance.material3)

  // Tooling & Tests
  debugImplementation(libs.androidx.compose.ui.tooling)
  debugImplementation(libs.androidx.compose.ui.test.manifest)
  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)
  androidTestImplementation(libs.androidx.compose.ui.test.junit4)
  androidTestImplementation(libs.androidx.test.core)
  androidTestImplementation(libs.androidx.test.ext.junit)
  androidTestImplementation(libs.androidx.test.runner)
  androidTestImplementation(libs.androidx.test.espresso.core)
}
