import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../payments.dart';
import '../models.dart';
import 'core.dart';

/// The customer's account and orders. Ordering needs an account (mobile number + 5-digit PIN).
///
/// Persisted: the sign-in token sits in secure storage and every phone has its own session on
/// the server, so a customer stays signed in - across restarts and app updates, and when they
/// also use another phone - until they sign out themselves. The delivery details are remembered
/// for the next checkout, and order keys are kept so orders from before accounts still show.
class Account {
  const Account({this.customer = const Customer(), this.signedIn = false, this.orders = const [], this.loading = false, this.error, this.hasKeys = false});
  final Customer customer;
  final bool signedIn;
  final List<Order> orders;
  final bool loading;
  final String? error;
  final bool hasKeys;

  bool get hasOrders => hasKeys || signedIn;

  Account copyWith({Customer? customer, bool? signedIn, List<Order>? orders, bool? loading, Object? error = keep, bool? hasKeys}) => Account(
        customer: customer ?? this.customer,
        signedIn: signedIn ?? this.signedIn,
        orders: orders ?? this.orders,
        loading: loading ?? this.loading,
        error: identical(error, keep) ? this.error : error as String?,
        hasKeys: hasKeys ?? this.hasKeys,
      );
}

final accountProvider = NotifierProvider<AccountStore, Account>(AccountStore.new);

class AccountStore extends Notifier<Account> {
  static const _keysKey = 'gaia_order_keys_v1';
  static const _customerKey = 'gaia_customer_v1';

  Api get _api => ref.read(apiProvider);
  TokenVault get _vault => ref.read(vaultProvider);
  String? get _token => _vault.read(TokenVault.customer);
  List<String> get _keys => ref.read(prefsProvider).getStringList(_keysKey) ?? const [];

  @override
  Account build() {
    var customer = const Customer();
    try {
      final raw = ref.read(prefsProvider).getString(_customerKey);
      if (raw != null) customer = Customer.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {}
    return Account(customer: customer, signedIn: _token != null, hasKeys: _keys.isNotEmpty);
  }

  Future<void> _remember(Customer c) => ref.read(prefsProvider).setString(_customerKey, jsonEncode(c.toJson()));

  /// Signs in to an existing account, or with [signUp] creates one (name needed).
  /// The account's saved delivery address pre-fills checkout.
  /// Creating needs the SMS code ([otp]) sent by [sendOtp].
  Future<void> signIn(String phone, String pin, {String name = '', bool signUp = false, String otp = ''}) async =>
      _finishSignIn(await _api.customerLogin(phone, pin, name: name, signUp: signUp, otp: otp));

  /// Texts a code to [phone] - to confirm a new account's number, or with [reset] to recover a PIN.
  /// Returns the seconds until another code may be asked for.
  Future<int> sendOtp(String phone, {required bool reset}) => _api.sendOtp(phone, reset: reset);

  /// Forgotten PIN: the SMS [otp] proves the number, [pin] becomes the new PIN and this phone is signed in.
  /// Any fingerprint sign-in saved with the old PIN stops working, so it is cleared.
  Future<void> resetPin(String phone, String otp, String pin) async {
    final r = await _api.customerResetPin(phone, otp, pin);
    await clearBiometric();
    await _finishSignIn(r);
  }

  /// Fingerprint / face sign-in saved on this phone: the number and PIN sit in secure storage.
  bool get biometricSaved => _vault.read(TokenVault.bioPhone) != null;
  String? get biometricPhone => _vault.read(TokenVault.bioPhone);

  Future<void> saveBiometric(String phone, String pin) async {
    await _vault.write(TokenVault.bioPhone, phone);
    await _vault.write(TokenVault.bioPin, pin);
  }

  Future<void> clearBiometric() async {
    await _vault.delete(TokenVault.bioPhone);
    await _vault.delete(TokenVault.bioPin);
    state = state.copyWith(); // screens showing the fingerprint row rebuild
  }

  /// Signs in with the saved number and PIN. Call only after the phone's own fingerprint / face check passed.
  /// When the server refuses the PIN (changed elsewhere) the saved copy is dropped.
  Future<void> signInSaved() async {
    final phone = _vault.read(TokenVault.bioPhone), pin = _vault.read(TokenVault.bioPin);
    if (phone == null || pin == null) throw ApiException('Fingerprint sign-in is not set up. Sign in with your PIN.');
    try {
      await signIn(phone, pin);
    } on ApiException catch (e) {
      if (e.message.startsWith('Wrong PIN') || e.message.startsWith('No account')) await clearBiometric();
      rethrow;
    }
  }

  Future<void> _finishSignIn(({String token, Customer customer}) r) async {
    await _vault.write(TokenVault.customer, r.token);
    final c = r.customer, was = state.customer;
    final customer = Customer(
      name: c.name,
      phone: c.phone,
      address: c.address.isNotEmpty ? c.address : was.address,
      pincode: c.pincode.isNotEmpty ? c.pincode : was.pincode,
      lat: c.lat ?? was.lat,
      lng: c.lng ?? was.lng,
    );
    await _remember(customer);
    state = state.copyWith(customer: customer, signedIn: true);
    await refresh();
  }

  /// Changes the name on the account. Throws [ApiException] when the server says no.
  Future<void> rename(String name) async {
    final t = _token;
    if (t == null) throw ApiException('Please sign in again.');
    final c = await _api.customerUpdate(t, {'name': name});
    final customer = Customer(name: c.name, phone: state.customer.phone, address: state.customer.address, pincode: state.customer.pincode, lat: state.customer.lat, lng: state.customer.lng);
    await _remember(customer);
    state = state.copyWith(customer: customer);
  }

  /// Saves the delivery address on this phone (it pre-fills checkout) and on the account.
  /// The account copy also updates with the next order, so a failed save there is not fatal.
  Future<void> setAddress({required String address, String pincode = '', double? lat, double? lng}) async {
    final was = state.customer;
    final customer = Customer(name: was.name, phone: was.phone, address: address, pincode: pincode, lat: lat, lng: lng);
    await _remember(customer);
    state = state.copyWith(customer: customer);
    final t = _token;
    if (t == null) return;
    try {
      await _api.customerUpdate(t, {'address': address, 'pincode': pincode, 'lat': lat, 'lng': lng});
    } catch (_) {}
  }

  /// Signs out on this phone only; the customer's other phones stay signed in.
  Future<void> signOut() async {
    final t = _token;
    await _vault.delete(TokenVault.customer);
    state = state.copyWith(signedIn: false, orders: const []);
    if (t != null) await _api.customerLogout(t);
  }

  /// The session is gone on the server (signed out elsewhere, account removed): forget it here too.
  Future<void> _sessionEnded() async {
    await _vault.delete(TokenVault.customer);
    state = state.copyWith(signedIn: false, orders: const []);
  }

  /// Places the order on the signed-in account. On success it is remembered, along with the
  /// delivery details for next time. Throws [ApiException] asking to sign in when there is no account.
  Future<Order> place({required Customer who, String? notes, required List<CartLine> lines, bool payOnline = false}) async {
    final t = _token;
    if (t == null) throw ApiException('Please sign in or create an account to place your order.');
    final Order o;
    try {
      o = await _api.placeOrder(token: t, customer: who, notes: notes, lines: lines, payOnline: payOnline);
    } on ApiException catch (e) {
      if (e.message.contains('sign in')) await _sessionEnded();
      rethrow;
    }
    final keys = [o.accessKey, ..._keys.where((k) => k != o.accessKey)].take(50).toList();
    await ref.read(prefsProvider).setStringList(_keysKey, keys);
    await _remember(who);
    state = state.copyWith(customer: who, hasKeys: true, orders: [o, ...state.orders.where((x) => x.accessKey != o.accessKey)]);
    return o;
  }

  Future<void> refresh() async {
    final t = _token, keys = _keys;
    if (keys.isEmpty && t == null) {
      state = state.copyWith(orders: const []);
      return;
    }
    state = state.copyWith(loading: true, error: null);
    try {
      final orders = t != null ? await _api.customerOrders(t) : await _api.orders(keys);
      state = state.copyWith(orders: orders, loading: false);
    } on ApiException catch (e) {
      state = state.copyWith(loading: false, error: e.message);
      if (e.message.contains('sign in')) await _sessionEnded();
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Something went wrong. Please try again.');
    }
  }

  /// Pays an order that is awaiting payment: our server starts an Easebuzz payment, the Easebuzz
  /// checkout opens, and then our server checks with Easebuzz how it went. Returns the order as it now
  /// stands - paid and placed, or still awaiting payment.
  Future<Order> payOnline(Order o) async {
    final t = _token;
    if (t == null) throw ApiException('Please sign in again to pay.');
    final start = await _api.startPayment(t, o.accessKey);
    final said = await ref.read(checkoutProvider)(start.accessKey, start.mode);
    var fresh = await _api.checkPayment(o.accessKey);
    // the checkout says it went through but Easebuzz has not settled it yet: ask again for a few seconds
    for (var i = 0; i < 3 && fresh.status == 'awaiting_payment' && (said ?? '').contains('success'); i++) {
      await Future<void>.delayed(const Duration(seconds: 2));
      fresh = await _api.checkPayment(o.accessKey);
    }
    _put(fresh);
    return fresh;
  }

  /// Pay in cash after all: the order goes ahead as cash on delivery.
  Future<Order> payInCash(Order o) async {
    final t = _token;
    if (t == null) throw ApiException('Please sign in again.');
    final fresh = await _api.payInCash(t, o.accessKey);
    _put(fresh);
    return fresh;
  }

  void _put(Order fresh) => state = state.copyWith(orders: [for (final x in state.orders) x.accessKey == fresh.accessKey ? fresh : x]);

  /// One order, fresh from the backend (for the status screen).
  Future<Order> reload(Order o) async {
    final fresh = await _api.order(o.accessKey);
    state = state.copyWith(orders: [for (final x in state.orders) x.accessKey == fresh.accessKey ? fresh : x]);
    return fresh;
  }
}
