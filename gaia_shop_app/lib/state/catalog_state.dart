import 'package:flutter/foundation.dart';

import '../api.dart';
import '../models.dart';

/// The menu: loaded from the backend, refreshable.
class CatalogState extends ChangeNotifier {
  CatalogState(this._api);
  final Api _api;

  Catalog? catalog;
  List<ShopBanner> banners = const [];
  bool loading = false;
  String? error;

  DeliveryRule get rule => catalog?.rule ?? const DeliveryRule();
  List<Product> get products => catalog?.products ?? const [];
  List<MenuCategory> get categories => catalog?.categories ?? const [];

  Product? bySku(String sku) {
    for (final p in products) {
      if (p.sku == sku) return p;
    }
    return null;
  }

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    // banners are extra: a backend without them (or a hiccup) falls back to the built-in set
    final bannersCall = _api.banners().then<List<ShopBanner>>((b) => b, onError: (_) => defaultBanners);
    try {
      catalog = await _api.catalog();
      banners = await bannersCall;
    } on ApiException catch (e) {
      error = e.message;
    } catch (_) {
      error = 'Something went wrong. Please try again.';
    }
    loading = false;
    notifyListeners();
  }
}
