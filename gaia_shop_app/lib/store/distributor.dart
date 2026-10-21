import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../models.dart';
import 'core.dart';

/// The distributor side: a distributor (or a salesman booking for one) signs in, picks the
/// distributor, fills quantities from the catalogue at dealer price and places a primary order.
class DistData {
  const DistData({
    this.profile,
    this.firms = const [],
    this.firm,
    this.products = const [],
    this.qty = const {},
    this.orders = const [],
    this.loading = false,
    this.placing = false,
    this.error,
  });

  final DistProfile? profile;
  final List<DistFirm> firms;
  final DistFirm? firm;
  final List<Product> products;

  /// sku -> quantity in the order being built.
  final Map<String, int> qty;
  final List<DistOrder> orders;
  final bool loading;
  final bool placing;
  final String? error;

  bool get signedIn => profile != null;
  int get lines => qty.length;
  int get units => qty.values.fold(0, (a, b) => a + b);
  double get total {
    var t = 0.0;
    for (final p in products) {
      t += p.price * (qty[p.sku] ?? 0);
    }
    return t;
  }

  DistData copyWith({
    Object? profile = keep,
    List<DistFirm>? firms,
    Object? firm = keep,
    List<Product>? products,
    Map<String, int>? qty,
    List<DistOrder>? orders,
    bool? loading,
    bool? placing,
    Object? error = keep,
  }) =>
      DistData(
        profile: identical(profile, keep) ? this.profile : profile as DistProfile?,
        firms: firms ?? this.firms,
        firm: identical(firm, keep) ? this.firm : firm as DistFirm?,
        products: products ?? this.products,
        qty: qty ?? this.qty,
        orders: orders ?? this.orders,
        loading: loading ?? this.loading,
        placing: placing ?? this.placing,
        error: identical(error, keep) ? this.error : error as String?,
      );
}

final distributorProvider = NotifierProvider<DistributorStore, DistData>(DistributorStore.new);

class DistributorStore extends Notifier<DistData> {
  static const _kindKey = 'gaia_dist_kind_v1';
  static const _nameKey = 'gaia_dist_name_v1';
  static const _phoneKey = 'gaia_dist_phone_v1';

  Api get _api => ref.read(apiProvider);
  TokenVault get _vault => ref.read(vaultProvider);
  String? get _token => _vault.read(TokenVault.distributor);

  @override
  DistData build() {
    final prefs = ref.read(prefsProvider);
    final k = prefs.getString(_kindKey), n = prefs.getString(_nameKey), p = prefs.getString(_phoneKey);
    return DistData(profile: _token != null && k != null && n != null && p != null ? DistProfile(kind: k, name: n, phone: p) : null);
  }

  Future<void> login(String phone, String pin) async {
    final r = await _api.distLogin(phone, pin);
    await _vault.write(TokenVault.distributor, r.token);
    final prefs = ref.read(prefsProvider);
    await prefs.setString(_kindKey, r.profile.kind);
    await prefs.setString(_nameKey, r.profile.name);
    await prefs.setString(_phoneKey, r.profile.phone);
    state = DistData(profile: r.profile);
  }

  Future<void> logout() async {
    await _vault.delete(TokenVault.distributor);
    final prefs = ref.read(prefsProvider);
    await prefs.remove(_kindKey);
    await prefs.remove(_nameKey);
    await prefs.remove(_phoneKey);
    state = const DistData();
  }

  /// A rejected token (replaced by a newer login, or the login was switched off) signs out.
  Future<void> _failed(ApiException e) async {
    state = state.copyWith(loading: false, placing: false, error: e.message);
    if (e.message.contains('sign in')) await logout();
  }

  /// Loads the distributors this login can order for; a single one is picked straight away.
  Future<void> start() async {
    final t = _token;
    if (t == null || state.loading) return;
    state = state.copyWith(loading: true, error: null);
    try {
      final firms = await _api.distFirms(t);
      state = state.copyWith(firms: firms, loading: false);
      if (firms.length == 1 && state.firm == null) await selectFirm(firms.first);
    } on ApiException catch (e) {
      await _failed(e);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Something went wrong. Please try again.');
    }
  }

  /// Switching distributor starts a fresh order (prices are per distributor).
  Future<void> selectFirm(DistFirm? f) async {
    final t = _token;
    state = state.copyWith(firm: f, products: const [], qty: const {}, error: null);
    if (f == null || t == null) return;
    state = state.copyWith(loading: true);
    try {
      final products = await _api.distProducts(t, f.uid);
      state = state.copyWith(products: products, loading: false);
    } on ApiException catch (e) {
      await _failed(e);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Something went wrong. Please try again.');
    }
  }

  void setQty(String sku, int n) {
    final q = {...state.qty};
    if (n <= 0) {
      q.remove(sku);
    } else {
      q[sku] = n;
    }
    state = state.copyWith(qty: q);
  }

  /// Places the order; returns its number, or null with [DistData.error] set.
  Future<int?> place({String? notes}) async {
    final t = _token, f = state.firm;
    if (t == null || f == null || state.qty.isEmpty || state.placing) return null;
    state = state.copyWith(placing: true, error: null);
    try {
      final id = await _api.distPlaceOrder(t, firmUid: f.uid, qty: state.qty, notes: notes);
      state = state.copyWith(placing: false, qty: const {});
      await loadOrders();
      return id;
    } on ApiException catch (e) {
      await _failed(e);
    } catch (_) {
      state = state.copyWith(placing: false, error: 'Something went wrong. Please try again.');
    }
    return null;
  }

  Future<void> loadOrders() async {
    final t = _token;
    if (t == null) return;
    try {
      state = state.copyWith(orders: await _api.distOrders(t));
    } on ApiException catch (e) {
      await _failed(e);
    } catch (_) {}
  }
}
