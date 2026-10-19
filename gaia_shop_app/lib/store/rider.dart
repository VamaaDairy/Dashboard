import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../api.dart';
import '../models.dart';
import 'core.dart';

/// The delivery rider side: who is signed in, the orders given to them, their finished days,
/// and where the phone is (shared with customers while delivering, also in the background).
class RiderData {
  const RiderData({this.profile, this.orders = const [], this.history = const [], this.loading = false, this.error, this.position, this.locationProblem});
  final RiderProfile? profile;
  final List<Order> orders;

  /// Finished deliveries by day; empty until loaded (or on an older backend).
  final List<DeliveryDay> history;
  final bool loading;
  final String? error;
  final Position? position;
  final String? locationProblem;

  bool get signedIn => profile != null;
  GeoPoint? get here => position == null ? null : GeoPoint(position!.latitude, position!.longitude);

  /// Which way the rider is going (degrees from north), once they are moving; null when standing still.
  double? get heading {
    final p = position;
    if (p == null || p.speed < 1 || p.heading < 0) return null;
    return p.heading;
  }

  RiderData copyWith({
    Object? profile = keep,
    List<Order>? orders,
    List<DeliveryDay>? history,
    bool? loading,
    Object? error = keep,
    Object? position = keep,
    Object? locationProblem = keep,
  }) =>
      RiderData(
        profile: identical(profile, keep) ? this.profile : profile as RiderProfile?,
        orders: orders ?? this.orders,
        history: history ?? this.history,
        loading: loading ?? this.loading,
        error: identical(error, keep) ? this.error : error as String?,
        position: identical(position, keep) ? this.position : position as Position?,
        locationProblem: identical(locationProblem, keep) ? this.locationProblem : locationProblem as String?,
      );
}

final riderProvider = NotifierProvider<RiderStore, RiderData>(RiderStore.new);

class RiderStore extends Notifier<RiderData> {
  static const _nameKey = 'gaia_rider_name_v1';
  static const _phoneKey = 'gaia_rider_phone_v1';

  StreamSubscription<Position>? _sub;
  DateTime _lastSent = DateTime.fromMillisecondsSinceEpoch(0);

  Api get _api => ref.read(apiProvider);
  TokenVault get _vault => ref.read(vaultProvider);
  String? get _token => _vault.read(TokenVault.rider);

  @override
  RiderData build() {
    ref.onDispose(() => _sub?.cancel());
    // stays signed in across restarts: token in secure storage, name and number in prefs
    final prefs = ref.read(prefsProvider);
    final n = prefs.getString(_nameKey), p = prefs.getString(_phoneKey);
    return RiderData(profile: _token != null && n != null && p != null ? RiderProfile(name: n, phone: p) : null);
  }

  Future<void> login(String phone, String pin) async {
    final r = await _api.riderLogin(phone, pin);
    await _vault.write(TokenVault.rider, r.token);
    final prefs = ref.read(prefsProvider);
    await prefs.setString(_nameKey, r.rider.name);
    await prefs.setString(_phoneKey, r.rider.phone);
    state = RiderData(profile: r.rider);
  }

  Future<void> logout() async {
    await stopSharing();
    await _vault.delete(TokenVault.rider);
    final prefs = ref.read(prefsProvider);
    await prefs.remove(_nameKey);
    await prefs.remove(_phoneKey);
    state = const RiderData();
  }

  Future<void> refresh() async {
    final t = _token;
    if (t == null || state.loading) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final orders = await _api.riderOrders(t);
      state = state.copyWith(orders: orders, loading: false);
    } on ApiException catch (e) {
      state = state.copyWith(loading: false, error: e.message);
      if (e.message.contains('sign in')) await logout(); // token replaced by a newer login, or rider deactivated
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Something went wrong. Please try again.');
    }
  }

  Future<void> pickup(Order o) async {
    await _api.riderPickup(_token!, o.id!);
    await refresh();
  }

  Future<void> deliver(Order o, String otp) async {
    await _api.riderDeliver(_token!, o.id!, otp);
    await refresh();
    await loadHistory();
  }

  /// The rider's past days. Quiet on failure: the current deliveries matter more.
  Future<void> loadHistory() async {
    final t = _token;
    if (t == null) return;
    try {
      state = state.copyWith(history: await _api.riderHistory(t));
    } catch (_) {}
  }

  /// Starts reporting this phone's position (at most every 6 s) so customers see the rider move.
  Future<void> startSharing() async {
    if (_sub != null) return;
    state = state.copyWith(locationProblem: null);
    if (!await Geolocator.isLocationServiceEnabled()) {
      state = state.copyWith(locationProblem: 'Turn on the phone\'s location (GPS) so customers can see where you are.');
      return;
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      state = state.copyWith(locationProblem: 'Allow location for Gaia in the phone\'s settings to share your position.');
      return;
    }
    _sub = Geolocator.getPositionStream(locationSettings: _settings()).listen(
      (p) {
        state = state.copyWith(position: p);
        final t = _token;
        if (t == null || DateTime.now().difference(_lastSent).inSeconds < 6) return;
        _lastSent = DateTime.now();
        _api.riderLocation(t, p.latitude, p.longitude).catchError((_) {}); // a missed ping is fine; the next one follows
      },
      onError: (_) {},
    );
  }

  /// On Android the stream runs in a foreground service, so the position keeps flowing
  /// with the screen off or another app (a call, WhatsApp) in front.
  static LocationSettings _settings() {
    if (defaultTargetPlatform != TargetPlatform.android) return const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 15);
    return AndroidSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 15,
      intervalDuration: const Duration(seconds: 5),
      foregroundNotificationConfig: const ForegroundNotificationConfig(
        notificationTitle: 'Gaia delivery',
        notificationText: 'Sharing your location with customers while you deliver',
        notificationChannelName: 'Delivery location',
        enableWakeLock: true,
        setOngoing: true,
      ),
    );
  }

  Future<void> stopSharing() async {
    await _sub?.cancel();
    _sub = null;
  }
}
