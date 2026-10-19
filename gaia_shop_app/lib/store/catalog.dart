import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../models.dart';
import 'core.dart';

/// The menu and the home banners.
///
/// Persisted: the last menu is kept on the phone and shown the moment the app opens - no
/// spinner, no waiting on the network. Fresh data is then fetched quietly with an ETag, so an
/// unchanged menu costs a few bytes (304) instead of the whole list. It is only fetched again
/// when it is older than [staleAfter], or when the customer pulls to refresh.
class CatalogData {
  const CatalogData({this.catalog, this.banners = const [], this.loading = false, this.error, this.fetchedAt});
  final Catalog? catalog;
  final List<ShopBanner> banners;

  /// True only while there is nothing to show yet (first ever open); background refreshes don't set it.
  final bool loading;
  final String? error;
  final DateTime? fetchedAt;

  DeliveryRule get rule => catalog?.rule ?? const DeliveryRule();
  List<Product> get products => catalog?.products ?? const [];
  List<MenuCategory> get categories => catalog?.categories ?? const [];

  Product? bySku(String sku) {
    for (final p in products) {
      if (p.sku == sku) return p;
    }
    return null;
  }

  CatalogData copyWith({Object? catalog = keep, List<ShopBanner>? banners, bool? loading, Object? error = keep, DateTime? fetchedAt}) => CatalogData(
        catalog: identical(catalog, keep) ? this.catalog : catalog as Catalog?,
        banners: banners ?? this.banners,
        loading: loading ?? this.loading,
        error: identical(error, keep) ? this.error : error as String?,
        fetchedAt: fetchedAt ?? this.fetchedAt,
      );
}

final catalogProvider = NotifierProvider<CatalogStore, CatalogData>(CatalogStore.new);

class CatalogStore extends Notifier<CatalogData> {
  static const staleAfter = Duration(minutes: 5);
  static const _menuKey = 'gaia_catalog_v1';
  static const _menuTagKey = 'gaia_catalog_etag_v1';
  static const _bannersKey = 'gaia_banners_v1';
  static const _bannersTagKey = 'gaia_banners_etag_v1';

  bool _busy = false;

  @override
  CatalogData build() {
    // restore what the phone had last time, synchronously: the menu is on screen immediately
    final prefs = ref.read(prefsProvider);
    Catalog? catalog;
    List<ShopBanner>? banners;
    try {
      final raw = prefs.getString(_menuKey);
      if (raw != null) catalog = Catalog.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {}
    try {
      final raw = prefs.getString(_bannersKey);
      if (raw != null) banners = ref.read(apiProvider).parseBanners(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {}
    return CatalogData(catalog: catalog, banners: banners ?? (catalog == null ? const [] : defaultBanners));
  }

  bool get _fresh => state.fetchedAt != null && DateTime.now().difference(state.fetchedAt!) < staleAfter;

  /// Brings the menu up to date. Does nothing while it is fresh, unless [force] (pull to refresh).
  Future<void> load({bool force = false}) async {
    await Future<void>.delayed(Duration.zero); // never change state in the middle of a build
    if (_busy || (!force && _fresh && state.catalog != null)) return;
    _busy = true;
    final firstTime = state.catalog == null;
    if (firstTime) state = state.copyWith(loading: true, error: null);
    final api = ref.read(apiProvider);
    final prefs = ref.read(prefsProvider);
    try {
      // both at once; banners are extra, so their failure never blocks the menu
      final bannersCall = api.fetchFresh('/banners', etag: state.banners.isEmpty ? null : prefs.getString(_bannersTagKey)).then<Object?>((v) => v, onError: (_) => null);
      final menu = await api.fetchFresh('/catalog', etag: firstTime ? null : prefs.getString(_menuTagKey));
      var next = state;
      if (!menu.unchanged && menu.raw != null) {
        next = next.copyWith(catalog: Catalog.fromJson(jsonDecode(menu.raw!) as Map<String, dynamic>));
        await prefs.setString(_menuKey, menu.raw!);
        if (menu.etag != null) await prefs.setString(_menuTagKey, menu.etag!);
      }
      final b = await bannersCall;
      if (b is ({String? raw, String? etag, bool unchanged}) && !b.unchanged && b.raw != null) {
        next = next.copyWith(banners: api.parseBanners(jsonDecode(b.raw!) as Map<String, dynamic>));
        await prefs.setString(_bannersKey, b.raw!);
        if (b.etag != null) await prefs.setString(_bannersTagKey, b.etag!);
      } else if (b == null && next.banners.isEmpty) {
        next = next.copyWith(banners: defaultBanners); // older backend without banners
      }
      state = next.copyWith(loading: false, error: null, fetchedAt: DateTime.now());
    } on ApiException catch (e) {
      // with a saved menu on screen, a failed refresh is not worth an error page
      state = state.copyWith(loading: false, error: state.catalog == null ? e.message : null);
    } catch (_) {
      state = state.copyWith(loading: false, error: state.catalog == null ? 'Something went wrong. Please try again.' : null);
    } finally {
      _busy = false;
    }
  }
}
