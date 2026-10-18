# shared_preferences_android (2.5+) is called from Dart through jnigen, which looks up
# classes and methods by name and full JNI signature at runtime. R8 must not strip or
# rename them, nor the Kotlin types jnigen touches (Continuation, Result, Unit, ...).
-keep class io.flutter.plugins.sharedpreferences.** { *; }
-keep class com.github.dart_lang.jni.** { *; }
-keep class kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**
