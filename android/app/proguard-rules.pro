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

# Keep RoomDatabase subclasses and constructors (WorkManager's WorkDatabase_Impl) under R8 full mode
-keep class * extends androidx.room.RoomDatabase {
    <init>();
    public <methods>;
    protected <methods>;
}

# Keep Glance widget ActionCallback constructors under R8 full mode
-keep public class * extends androidx.glance.appwidget.action.ActionCallback {
    public <init>();
}

# Keep VersionedParcelable, WorkManager workers, App Startup initializers, and AndroidViewModel constructors
-keep class * implements androidx.versionedparcelable.VersionedParcelable {
    <init>();
}
-keep public class * extends androidx.work.ListenableWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}
-keep public class * extends androidx.startup.Initializer {
    <init>();
}
-keep public class * extends androidx.lifecycle.AndroidViewModel {
    public <init>(android.app.Application);
}
