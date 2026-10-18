import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api.dart';
import '../models.dart';

/// The customer's own orders. Signed in (mobile number + 5-digit PIN), the backend lists every
/// order placed with that number. Not signed in, the phone keeps each order's secret key and
/// asks the backend for the details, so nobody else's orders can be seen.
class OrdersState extends ChangeNotifier {
  OrdersState(this._api, this._prefs) {
    _keys = _prefs.getStringList(_keysKey) ?? [];
    _token = _prefs.getString(_tokenKey);
    final raw = _prefs.getString(_customerKey);
    if (raw != null) {
      try {
        customer = Customer.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      } catch (_) {
        customer = const Customer();
      }
    }
  }

  static const _keysKey = 'gaia_order_keys_v1';
  static const _customerKey = 'gaia_customer_v1';
  static const _tokenKey = 'gaia_customer_token_v1';

  final Api _api;
  final SharedPreferences _prefs;
  late List<String> _keys;
  String? _token;

  Customer customer = const Customer();
  List<Order> orders = [];
  bool loading = false;
  String? error;

  bool get signedIn => _token != null;

  /// Signs in with the mobile number and PIN (creating the account the first time, which needs a name).
  Future<void> signIn(String phone, String pin, {String name = ''}) async {
    final r = await _api.customerLogin(phone, pin, name: name);
    _token = r.token;
    await _prefs.setString(_tokenKey, r.token);
    customer = Customer(name: r.name, phone: r.phone, address: customer.address, pincode: customer.pincode, lat: customer.lat, lng: customer.lng);
    await _prefs.setString(_customerKey, jsonEncode(customer.toJson()));
    notifyListeners();
    await refresh();
  }

  Future<void> signOut() async {
    _token = null;
    orders = [];
    await _prefs.remove(_tokenKey);
    notifyListeners();
  }

  /// Places the order. On success it is remembered, along with the delivery details for next time.
  Future<Order> place({required Customer who, String? notes, required List<CartLine> lines}) async {
    final o = await _api.placeOrder(customer: who, notes: notes, lines: lines);
    _keys = [o.accessKey, ..._keys.where((k) => k != o.accessKey)].take(50).toList();
    await _prefs.setStringList(_keysKey, _keys);
    customer = who;
    await _prefs.setString(_customerKey, jsonEncode(who.toJson()));
    orders = [o, ...orders.where((x) => x.accessKey != o.accessKey)];
    notifyListeners();
    return o;
  }

  Future<void> refresh() async {
    if (_keys.isEmpty && _token == null) {
      orders = [];
      notifyListeners();
      return;
    }
    loading = true;
    error = null;
    notifyListeners();
    try {
      final t = _token;
      orders = t != null ? await _api.customerOrders(t) : await _api.orders(_keys);
    } on ApiException catch (e) {
      error = e.message;
      if (e.message.contains('sign in')) await signOut(); // token replaced by a newer sign-in on another phone
    } catch (_) {
      error = 'Something went wrong. Please try again.';
    }
    loading = false;
    notifyListeners();
  }

  /// One order, fresh from the backend (for the status screen).
  Future<Order> reload(Order o) async {
    final fresh = await _api.order(o.accessKey);
    orders = [for (final x in orders) x.accessKey == fresh.accessKey ? fresh : x];
    notifyListeners();
    return fresh;
  }

  bool get hasOrders => _keys.isNotEmpty || _token != null;
}
