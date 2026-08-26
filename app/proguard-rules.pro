# ---- MusicFlow ProGuard Rules ----

# Keep Retrofit models (Gson serialization)
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.example.musicflow.data.api.** { *; }
-keep class com.example.musicflow.data.model.** { *; }

# Gson
-keep class com.google.gson.** { *; }
-dontwarn com.google.gson.**

# Retrofit
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Media3 / ExoPlayer
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.**

# Coil
-dontwarn coil.**

# Compose — keep Composable metadata
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**

# Keep data classes used with Gson
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Coroutines
-dontwarn kotlinx.coroutines.**
