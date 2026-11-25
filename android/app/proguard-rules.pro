# Keep Kotlinx Serialization models & generated serializers for R8 release builds
-keepattributes *Annotation*, InnerClasses
-keep,includedescriptorclasses class ru.studyhub.app.data.** { *; }
-keepclassmembers class ru.studyhub.app.data.** {
    *** Companion;
}
-keepclasseswithmembers class * {
    public static kotlinx.serialization.KSerializer serializer(...);
}

# Keep WebView JS bridge methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Standard OkHttp / Okio / Coroutines rules
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
-dontwarn org.bouncycastle.**
-dontwarn javax.annotation.**
