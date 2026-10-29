import 'package:easebuzz_flutter/easebuzz_flutter.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Opens the Easebuzz checkout (UPI, cards, net banking) for an access key our server got from Easebuzz,
/// and returns what the checkout said when it closed (a JSON string; null if it could not open).
/// The answer is only a hint: whether the order is paid is always asked of our server, which asks Easebuzz.
typedef OpenCheckout = Future<String?> Function(String accessKey, String mode);

Future<String?> _easebuzz(String accessKey, String mode) async {
  try {
    return await EasebuzzFlutter().payWithEasebuzz(accessKey, mode);
  } on PlatformException catch (e) {
    return '{"result":"error","error":"${e.message}"}';
  }
}

/// Swap in a fake checkout for tests.
final checkoutProvider = Provider<OpenCheckout>((ref) => _easebuzz);
