import 'package:local_auth/local_auth.dart';

/// The phone's own fingerprint / face check (Android BiometricPrompt, iOS Face ID / Touch ID).
/// Gaia never sees the biometric; the phone only answers yes or no.
class Biometric {
  static final _auth = LocalAuthentication();

  /// True when this phone has a fingerprint or face enrolled that the app may use.
  static Future<bool> available() async {
    try {
      return await _auth.isDeviceSupported() && (await _auth.getAvailableBiometrics()).isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// "Face ID", "fingerprint" ... for button labels.
  static Future<String> label() async {
    try {
      final t = await _auth.getAvailableBiometrics();
      if (t.contains(BiometricType.face) && !t.contains(BiometricType.fingerprint)) return 'face unlock';
      if (t.contains(BiometricType.fingerprint) && !t.contains(BiometricType.face)) return 'fingerprint';
    } catch (_) {}
    return 'fingerprint or face';
  }

  /// Asks the phone to check the person; false if they cancel or it fails.
  static Future<bool> confirm(String reason) async {
    try {
      return await _auth.authenticate(localizedReason: reason, biometricOnly: true);
    } catch (_) {
      return false;
    }
  }
}
