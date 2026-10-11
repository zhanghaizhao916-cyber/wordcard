plugins {
    id("com.android.application")
}

android {
    namespace = "com.zhang.cet4words"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.zhang.cet4words"
        minSdk = 24
        targetSdk = 34
        // 版本号规则：MAJOR.MINOR.PATCH
        // versionCode = MAJOR*10000 + MINOR*100 + PATCH
        // 当前 1.7.1 → 10701
        versionCode = 10701
        versionName = "1.7.1"
        resConfigs("zh", "en")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            // 首版无正式签名，release 复用 debug 签名便于侧载安装
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}
