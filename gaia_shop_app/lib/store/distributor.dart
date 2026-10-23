import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../models.dart';
import 'cart.dart';
import 'catalog.dart';
import 'core.dart';

/// The distributor side: a distributor (or a sales officer booking for one) signs in and then uses
/// the same app as everyone else - same menu, product pages and cart - with the distributor's
/// dealer prices. Placing the cart creates a primary order instead of a delivery.
class DistData {
  const DistData({
    this.profile,
    this.firms = const [],
    this.states = const [],
    this.firm,
    this.products = const [],
    this.orders = const [],
    this.loading = false,
    this.placing = false,
    this.error,
  });

  final DistProfile? profile;
  final List<DistFirm> firms;

  /// The states a distributor's profile can be set to (as in Customer Masters).
  final List<String> states;
  final DistFirm? firm;

  /// The menu at [firm]'s dealer price.
  final List<Product> products;
  final List<DistOrder> orders;
  final bool loading;
  final bool placing;
  final String? error;

  bool get signedIn => profile != null;

  DistData copyWith({
    Object? profile = keep,
    List<DistFirm>? firms,
    List<String>? states,
    Object? firm = keep,
    List<Product>? products,
    List<DistOrder>? orders,
    bool? loading,
    bool? placing,
    Object? error = keep,
  }) =>
      DistData(
        profile: identical(profile, keep) ? this.profile : profile as DistProfile?,
        firms: firms ?? this.firms,
        states: states ?? this.states,
        firm: identical(firm, keep) ? this.firm : firm as DistFirm?,
        products: products ?? this.products,
        orders: orders ?? this.orders,
        loading: loading ?? this.loading,
        placing: placing ?? this.placing,
        error: identical(error, keep) ? this.error : error as String?,
      );
}

final distributorProvider = NotifierProvider<DistributorStore, DistData>(DistributorStore.new);

/// The distributor's menu, built once per price list: it only changes when the dealer prices or the
/// items do - not on every loading flag, order refresh or distributor-list update - so the home
/// screen and the cart stay put. An empty list while a distributor's prices load is "nothing yet".
final _distCatalogProvider = Provider<Catalog?>((ref) {
  final products = ref.watch(distributorProvider.select((d) => d.products));
  final waiting = ref.watch(distributorProvider.select((d) => d.products.isEmpty && (d.firm == null || d.loading)));
  final categories = ref.watch(catalogProvider.select((c) => c.categories));
  if (waiting) return null;
  return Catalog(rule: const DeliveryRule(), categories: categories, products: products);
});

/// What the menu, product pages and cart show: the retail menu normally, or - for a signed-in
/// distributor with a distributor chosen - the same menu at dealer prices (and no delivery fee).
final menuProvider = Provider<CatalogData>((ref) {
  if (!ref.watch(distributorProvider.select((d) => d.signedIn))) return ref.watch(catalogProvider);
  final catalog = ref.watch(_distCatalogProvider);
  final banners = ref.watch(catalogProvider.select((c) => c.banners));
  // loading / error only matter while there is no menu to show
  final loading = ref.watch(distributorProvider.select((d) => d.products.isEmpty && d.loading));
  final error = ref.watch(distributorProvider.select((d) => d.products.isEmpty ? d.error : null));
  return CatalogData(catalog: catalog, banners: banners, loading: loading, error: error);
});

class DistributorStore extends Notifier<DistData> {
  static const _kindKey = 'gaia_dist_kind_v1';
  static const _nameKey = 'gaia_dist_name_v1';
  static const _phoneKey = 'gaia_dist_phone_v1';

  Api get _api => ref.read(apiProvider);
  TokenVault get _vault => ref.read(vaultProvider);
  DateTime? _pricedAt;
  bool _pricing = false;
  String? get _token => _vault.read(TokenVault.distributor);

  @override
  DistData build() {
    final prefs = ref.read(prefsProvider);
    final k = prefs.getString(_kindKey), n = prefs.getString(_nameKey), p = prefs.getString(_phoneKey);
    return DistData(profile: _token != null && k != null && n != null && p != null ? DistProfile(kind: k, name: n, phone: p) : null);
  }

  Future<void> login(String phone, String pin, String kind) async {
    final r = await _api.distLogin(phone, pin, kind);
    await _vault.write(TokenVault.distributor, r.token);
    final prefs = ref.read(prefsProvider);
    await prefs.setString(_kindKey, r.profile.kind);
    await prefs.setString(_nameKey, r.profile.name);
    await prefs.setString(_phoneKey, r.profile.phone);
    // a retail cart is priced differently: start clean
    ref.read(cartProvider.notifier).clear();
    state = DistData(profile: r.profile);
  }

  Future<void> logout() async {
    await _vault.delete(TokenVault.distributor);
    final prefs = ref.read(prefsProvider);
    await prefs.remove(_kindKey);
    await prefs.remove(_nameKey);
    await prefs.remove(_phoneKey);
    ref.read(cartProvider.notifier).clear();
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
      final r = await _api.distFirms(t);
      final firms = r.firms;
      state = state.copyWith(firms: firms, states: r.states, loading: false);
      if (firms.length == 1 && state.firm == null) await selectFirm(firms.first);
    } on ApiException catch (e) {
      await _failed(e);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Something went wrong. Please try again.');
    }
  }

  /// Switching distributor changes the prices, so it starts a fresh cart.
  Future<void> selectFirm(DistFirm? f) async {
    final t = _token;
    ref.read(cartProvider.notifier).clear();
    // one change, so the menu goes straight to "loading" - never a flash of an empty menu
    state = state.copyWith(firm: f, products: const [], error: null, loading: f != null && t != null);
    if (f == null || t == null) return;
    try {
      final products = await _api.distProducts(t, f.uid);
      _pricedAt = DateTime.now();
      state = state.copyWith(products: products, loading: false);
    } on ApiException catch (e) {
      await _failed(e);
    } catch (_) {
      state = state.copyWith(loading: false, error: 'Something went wrong. Please try again.');
    }
  }

  /// Fetches the chosen distributor's dealer prices again, in the background: the menu on screen
  /// stays as it is and only changes if a price or an item actually changed. Used when the app is
  /// opened again; [minGap] stops back-to-back calls (a dialog closing also "reopens" the app).
  Future<void> refreshPrices({Duration minGap = const Duration(seconds: 30)}) async {
    final t = _token, f = state.firm;
    if (t == null || f == null || _pricing || state.loading) return;
    if (_pricedAt != null && DateTime.now().difference(_pricedAt!) < minGap) return;
    _pricing = true;
    try {
      final products = await _api.distProducts(t, f.uid);
      _pricedAt = DateTime.now();
      if (state.firm?.uid == f.uid && !_samePrices(state.products, products)) state = state.copyWith(products: products);
    } on ApiException catch (e) {
      if (e.message.contains('sign in')) await logout();
    } catch (_) {
      // no signal: keep the prices already on screen
    } finally {
      _pricing = false;
    }
  }

  static bool _samePrices(List<Product> a, List<Product> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      final x = a[i], y = b[i];
      if (x.sku != y.sku || x.price != y.price || x.mrp != y.mrp || x.name != y.name || x.image != y.image || x.size != y.size) return false;
    }
    return true;
  }

  /// Places the cart as a primary order; returns its number, or null with [DistData.error] set.
  Future<int?> place(Map<String, int> qty, {String? notes}) async {
    final t = _token, f = state.firm;
    if (t == null || f == null || qty.isEmpty || state.placing) return null;
    state = state.copyWith(placing: true, error: null);
    try {
      final id = await _api.distPlaceOrder(t, firmUid: f.uid, qty: qty, notes: notes);
      state = state.copyWith(placing: false);
      ref.read(cartProvider.notifier).clear();
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

  /// Saves changed details of [firmUid] to the dashboard's masters. Throws an [ApiException] with the
  /// server's message (and per-field messages) when something is not acceptable.
  Future<void> saveFirm(String firmUid, Map<String, Object?> changes) async {
    final t = _token;
    if (t == null) throw ApiException('Please sign in again.');
    try {
      final r = await _api.distSaveFirm(t, firmUid, changes);
      final prefs = ref.read(prefsProvider);
      await prefs.setString(_nameKey, r.name);
      await prefs.setString(_phoneKey, r.phone);
      state = state.copyWith(
        firms: [for (final f in state.firms) f.uid == r.firm.uid ? r.firm : f],
        firm: state.firm?.uid == r.firm.uid ? r.firm : state.firm,
        profile: DistProfile(kind: state.profile?.kind ?? 'distributor', name: r.name, phone: r.phone),
      );
    } on ApiException catch (e) {
      if (e.message.contains('sign in')) await logout();
      rethrow;
    }
  }
}
