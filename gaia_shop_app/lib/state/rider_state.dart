import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api.dart';
import '../models.dart';

/// The delivery rider side of the app: sign-in, the orders given to them, and sharing
/// their location with the customer while they have deliveries (kept alive in the background on Android).
class RiderState extends ChangeNotifier {
  RiderState(this._api, this._prefs) {
    _token = _prefs.getString(_tokenKey);
    final n = _prefs.getString(_nameKey);
    final p = _prefs.getString(_phoneKey);
    if (_token != null && n != null && p != null) profile = RiderProfile(name: n, phone: p);
  }

  static const _tokenKey = 'gaia_rider_token_v1';
  static const _nameKey = 'gaia_rider_name_v1';
  static const _phoneKey = 'gaia_rider_phone_v1';

  final Api _api;
  final SharedPreferences _prefs;
  String? _token;

  RiderProfile? profile;
  List<Order> orders = [];
  bool loading = false;
  String? error;
  Position? position;
  String? locationProblem;

  StreamSubscription<Position>? _sub;
  DateTime _lastSent = DateTime.fromMillisecondsSinceEpoch(0);

  bool get signedIn => _token != null && profile != null;
  GeoPoint? get here => position == null ? null : GeoPoint(position!.latitude, position!.longitude);

  /// Which way the rider is going (degrees from north), once they are moving; null when standing still.
  double? get heading {
    final p = position;
    if (p == null || p.speed < 1 || p.heading < 0) return null;
    return p.heading;
  }

  Future<void> login(String phone, String pin) async {
    final r = await _api.riderLogin(phone, pin);
    _token = r.token;
    profile = r.rider;
    await _prefs.setString(_tokenKey, r.token);
    await _prefs.setString(_nameKey, r.rider.name);
    await _prefs.setString(_phoneKey, r.rider.phone);
    notifyListeners();
  }

  Future<void> logout() async {
    await stopSharing();
    _token = null;
    profile = null;
    orders = [];
    await _prefs.remove(_tokenKey);
    await _prefs.remove(_nameKey);
    await _prefs.remove(_phoneKey);
    notifyListeners();
  }

  Future<void> refresh() async {
    final t = _token;
    if (t == null || loading) return;
    loading = true;
    error = null;
    notifyListeners();
    try {
      orders = await _api.riderOrders(t);
    } on ApiException catch (e) {
      error = e.message;
      if (e.message.contains('sign in')) await logout(); // token replaced by a newer login, or rider deactivated
    } catch (_) {
      error = 'Something went wrong. Please try again.';
    }
    loading = false;
    notifyListeners();
  }

  Future<void> pickup(Order o) async {
    await _api.riderPickup(_token!, o.id!);
    await refresh();
  }

  Future<void> deliver(Order o, String otp) async {
    await _api.riderDeliver(_token!, o.id!, otp);
    await refresh();
  }

  /// Starts reporting this phone's position (at most every 6 s) so customers see the rider move.
  Future<void> startSharing() async {
    if (_sub != null) return;
    locationProblem = null;
    if (!await Geolocator.isLocationServiceEnabled()) {
      locationProblem = 'Turn on the phone\'s location (GPS) so customers can see where you are.';
      notifyListeners();
      return;
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      locationProblem = 'Allow location for Gaia in the phone\'s settings to share your position.';
      notifyListeners();
      return;
    }
    _sub = Geolocator.getPositionStream(locationSettings: _settings()).listen(
      (p) {
        position = p;
        notifyListeners();
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

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
