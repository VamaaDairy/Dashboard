import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
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
  Future<void> signIn(String phone, String pin, {String name = '', bool signUp = false}) async {
    final r = await _api.customerLogin(phone, pin, name: name, signUp: signUp);
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
  Future<Order> place({required Customer who, String? notes, required List<CartLine> lines}) async {
    final t = _token;
    if (t == null) throw ApiException('Please sign in or create an account to place your order.');
    final Order o;
    try {
      o = await _api.placeOrder(token: t, customer: who, notes: notes, lines: lines);
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

  /// One order, fresh from the backend (for the status screen).
  Future<Order> reload(Order o) async {
    final fresh = await _api.order(o.accessKey);
    state = state.copyWith(orders: [for (final x in state.orders) x.accessKey == fresh.accessKey ? fresh : x]);
    return fresh;
  }
}
