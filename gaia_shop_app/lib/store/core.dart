import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api.dart';

/// App-wide state lives in Riverpod stores (like Zustand stores): one store per area - catalog,
/// cart, account, rider, map - each a Notifier with an immutable state. Widgets `ref.watch` a
/// store (or `.select` one value of it, so they only rebuild when that value changes) and call
/// its actions through `ref.read(store.notifier)`. Stores that should outlive a restart persist
/// themselves to the phone (SharedPreferences; sign-in tokens in [TokenVault]).

/// Opened in main() before the app starts, so stores can restore synchronously.
final prefsProvider = Provider<SharedPreferences>((ref) => throw StateError('prefsProvider must be overridden in main()'));

/// The secure token store, opened in main() as well.
final vaultProvider = Provider<TokenVault>((ref) => throw StateError('vaultProvider must be overridden in main()'));

/// The backend. Tests override it with a fake.
final apiProvider = Provider<Api>((ref) => Api());

/// Sign-in tokens, kept in the phone's secure storage (Android Keystore / iOS Keychain) and
/// mirrored in memory so stores can read them synchronously.
class TokenVault {
  TokenVault._(this._store, this._cache);

  static const customer = 'gaia_customer_token';
  static const rider = 'gaia_rider_token';
  static const distributor = 'gaia_distributor_token';

  final FlutterSecureStorage _store;
  final Map<String, String> _cache;

  /// Loads the tokens; tokens an older version kept in SharedPreferences move over (once).
  static Future<TokenVault> open(SharedPreferences prefs) async {
    const store = FlutterSecureStorage();
    final cache = <String, String>{};
    const legacy = {customer: 'gaia_customer_token_v1', rider: 'gaia_rider_token_v1', distributor: 'gaia_distributor_token_v1'};
    for (final e in legacy.entries) {
      String? v;
      try {
        v = await store.read(key: e.key);
      } catch (_) {
        v = null; // unreadable (e.g. restored from a backup on another phone): sign in again
      }
      final old = prefs.getString(e.value);
      if (v == null && old != null) {
        v = old;
        try {
          await store.write(key: e.key, value: old);
          await prefs.remove(e.value);
        } catch (_) {}
      }
      if (v != null) cache[e.key] = v;
    }
    return TokenVault._(store, cache);
  }

  /// For tests: tokens in memory only.
  factory TokenVault.memory([Map<String, String> tokens = const {}]) => TokenVault._(const FlutterSecureStorage(), {...tokens}).._memoryOnly = true;

  bool _memoryOnly = false;

  String? read(String key) => _cache[key];

  Future<void> write(String key, String value) async {
    _cache[key] = value;
    if (!_memoryOnly) await _store.write(key: key, value: value);
  }

  Future<void> delete(String key) async {
    _cache.remove(key);
    if (!_memoryOnly) await _store.delete(key: key);
  }
}

/// Marker for copyWith: "leave this field as it is" (so a nullable field can still be set to null).
const keep = Object();
