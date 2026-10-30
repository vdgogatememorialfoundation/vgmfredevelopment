plugins {
    id("com.android.application")
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "org.vaidyagogate.vgmf"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "org.vaidyagogate.customer"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    flavorDimensions += "role"
    productFlavors {
        create("customer") {
            dimension = "role"
            applicationId = "org.vaidyagogate.customer"
        }
        create("admin") {
            dimension = "role"
            applicationId = "org.vaidyagogate.admin"
        }
        create("staff") {
            dimension = "role"
            applicationId = "org.vaidyagogate.staff"
        }
        create("support") {
            dimension = "role"
            applicationId = "org.vaidyagogate.support"
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("debug")
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
