# shared_preferences_android (2.5+) is called from Dart through jnigen, which looks up
# classes and methods by name and full JNI signature at runtime. R8 must not strip or
# rename them, nor the Kotlin types jnigen touches (Continuation, Result, Unit, ...).
-keep class io.flutter.plugins.sharedpreferences.** { *; }
-keep class com.github.dart_lang.jni.** { *; }
-keep class kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**

# Easebuzz payment SDK (in.easebuzz:android-v2, through the easebuzz_flutter plugin): its checkout
# screen, data models and the Gson (de)serialisation it relies on must survive R8 untouched.
-keep class com.easebuzz.** { *; }
-keep class datamodels.** { *; }
-keep class com.google.gson.** { *; }
-keepattributes Signature, *Annotation*, InnerClasses, EnclosingMethod
-dontwarn com.easebuzz.**
-dontwarn datamodels.**
