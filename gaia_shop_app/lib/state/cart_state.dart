import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models.dart';

/// The cart. Kept on the phone, so it survives closing the app.
class CartState extends ChangeNotifier {
  CartState(this._prefs) {
    _restore();
  }

  static const _key = 'gaia_cart_v1';
  static const maxPerItem = 20;

  final SharedPreferences _prefs;
  final List<CartLine> _lines = [];
  DeliveryRule rule = const DeliveryRule();

  List<CartLine> get lines => List.unmodifiable(_lines);
  int get count => _lines.fold(0, (s, l) => s + l.qty);
  bool get isEmpty => _lines.isEmpty;
  double get subtotal => _lines.fold(0.0, (s, l) => s + l.total);
  double get delivery => rule.forSubtotal(subtotal);
  double get total => subtotal + delivery;

  /// How much more to add for free delivery, or 0.
  double get toFreeDelivery => (rule.freeAbove > 0 && subtotal > 0 && subtotal < rule.freeAbove) ? rule.freeAbove - subtotal : 0;

  int qtyOf(String sku) {
    for (final l in _lines) {
      if (l.sku == sku) return l.qty;
    }
    return 0;
  }

  void add(Product p) {
    final i = _lines.indexWhere((l) => l.sku == p.sku);
    if (i >= 0) {
      if (_lines[i].qty < maxPerItem) _lines[i].qty++;
    } else {
      _lines.add(CartLine(sku: p.sku, name: p.name, price: p.price, image: p.image, size: p.size, qty: 1));
    }
    _changed();
  }

  void setQty(String sku, int qty) {
    final i = _lines.indexWhere((l) => l.sku == sku);
    if (i < 0) return;
    if (qty <= 0) {
      _lines.removeAt(i);
    } else {
      _lines[i].qty = qty > maxPerItem ? maxPerItem : qty;
    }
    _changed();
  }

  void clear() {
    _lines.clear();
    _changed();
  }

  /// Prices may have changed since an item was added; bring the cart in line with the current menu
  /// and drop anything that is no longer sold.
  void syncWith(List<Product> menu) {
    if (menu.isEmpty) return;
    final bySku = {for (final p in menu) p.sku: p};
    var changed = false;
    _lines.removeWhere((l) {
      final gone = !bySku.containsKey(l.sku);
      if (gone) changed = true;
      return gone;
    });
    for (var i = 0; i < _lines.length; i++) {
      final p = bySku[_lines[i].sku]!;
      if (p.price != _lines[i].price) {
        _lines[i] = CartLine(sku: p.sku, name: p.name, price: p.price, image: p.image, size: p.size, qty: _lines[i].qty);
        changed = true;
      }
    }
    if (changed) _changed();
  }

  void setRule(DeliveryRule r) {
    if (r.fee == rule.fee && r.freeAbove == rule.freeAbove) return;
    rule = r;
    notifyListeners();
  }

  void _changed() {
    _prefs.setString(_key, jsonEncode(_lines.map((l) => l.toJson()).toList()));
    notifyListeners();
  }

  void _restore() {
    try {
      final raw = _prefs.getString(_key);
      if (raw == null) return;
      for (final e in jsonDecode(raw) as List) {
        final l = CartLine.fromJson(e as Map<String, dynamic>);
        if (l.qty > 0) _lines.add(l);
      }
    } catch (_) {
      _lines.clear(); // a damaged cart is not worth crashing for
    }
  }
}
