import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api.dart';
import '../models.dart';

/// The customer's account and orders. Ordering needs an account (mobile number + 5-digit PIN);
/// the backend keeps every order against it, so history follows the customer to any phone.
/// Order keys are also kept on the phone so orders placed before accounts still show.
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

  /// Signs in to an existing account, or with [signUp] creates one (name needed).
  /// The account's saved delivery address pre-fills checkout.
  Future<void> signIn(String phone, String pin, {String name = '', bool signUp = false}) async {
    final r = await _api.customerLogin(phone, pin, name: name, signUp: signUp);
    _token = r.token;
    await _prefs.setString(_tokenKey, r.token);
    final c = r.customer;
    customer = Customer(
      name: c.name,
      phone: c.phone,
      address: c.address.isNotEmpty ? c.address : customer.address,
      pincode: c.pincode.isNotEmpty ? c.pincode : customer.pincode,
      lat: c.lat ?? customer.lat,
      lng: c.lng ?? customer.lng,
    );
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

  /// Places the order on the signed-in account. On success it is remembered, along with the
  /// delivery details for next time. Throws [ApiException] asking to sign in when there is no account.
  Future<Order> place({required Customer who, String? notes, required List<CartLine> lines}) async {
    final t = _token;
    if (t == null) throw ApiException('Please sign in or create an account to place your order.');
    final Order o;
    try {
      o = await _api.placeOrder(token: t, customer: who, notes: notes, lines: lines);
    } on ApiException catch (e) {
      if (e.message.contains('sign in')) await signOut(); // signed in on another phone since
      rethrow;
    }
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
