import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models.dart';
import 'core.dart';

/// The cart. Persisted on the phone, so it survives closing the app; no account needed for it.
class Cart {
  const Cart({this.lines = const [], this.rule = const DeliveryRule()});
  final List<CartLine> lines;
  final DeliveryRule rule;

  int get count => lines.fold(0, (s, l) => s + l.qty);
  bool get isEmpty => lines.isEmpty;
  double get subtotal => lines.fold(0.0, (s, l) => s + l.total);
  double get delivery => rule.forSubtotal(subtotal);
  double get total => subtotal + delivery;

  /// How much more to add for free delivery, or 0.
  double get toFreeDelivery => (rule.freeAbove > 0 && subtotal > 0 && subtotal < rule.freeAbove) ? rule.freeAbove - subtotal : 0;

  int qtyOf(String sku) {
    for (final l in lines) {
      if (l.sku == sku) return l.qty;
    }
    return 0;
  }
}

final cartProvider = NotifierProvider<CartStore, Cart>(CartStore.new);

class CartStore extends Notifier<Cart> {
  static const _key = 'gaia_cart_v1';
  static const maxPerItem = 20;

  @override
  Cart build() {
    try {
      final raw = ref.read(prefsProvider).getString(_key);
      if (raw == null) return const Cart();
      final lines = [for (final e in jsonDecode(raw) as List) CartLine.fromJson(e as Map<String, dynamic>)].where((l) => l.qty > 0).toList();
      return Cart(lines: lines);
    } catch (_) {
      return const Cart(); // a damaged cart is not worth crashing for
    }
  }

  void _set(List<CartLine> lines) {
    state = Cart(lines: List.unmodifiable(lines), rule: state.rule);
    ref.read(prefsProvider).setString(_key, jsonEncode(lines.map((l) => l.toJson()).toList()));
  }

  void add(Product p) {
    final lines = [...state.lines];
    final i = lines.indexWhere((l) => l.sku == p.sku);
    if (i >= 0) {
      if (lines[i].qty >= maxPerItem) return;
      lines[i] = lines[i].withQty(lines[i].qty + 1);
    } else {
      lines.add(CartLine(sku: p.sku, name: p.name, price: p.price, image: p.image, size: p.size, qty: 1));
    }
    _set(lines);
  }

  void setQty(String sku, int qty) {
    final lines = [...state.lines];
    final i = lines.indexWhere((l) => l.sku == sku);
    if (i < 0) return;
    if (qty <= 0) {
      lines.removeAt(i);
    } else {
      lines[i] = lines[i].withQty(qty > maxPerItem ? maxPerItem : qty);
    }
    _set(lines);
  }

  void clear() => _set(const []);

  /// Prices may have changed since an item was added; bring the cart in line with the current menu
  /// and drop anything that is no longer sold.
  void syncWith(List<Product> menu) {
    if (menu.isEmpty) return;
    final bySku = {for (final p in menu) p.sku: p};
    var changed = false;
    final lines = <CartLine>[];
    for (final l in state.lines) {
      final p = bySku[l.sku];
      if (p == null) {
        changed = true;
      } else if (p.price != l.price) {
        lines.add(CartLine(sku: p.sku, name: p.name, price: p.price, image: p.image, size: p.size, qty: l.qty));
        changed = true;
      } else {
        lines.add(l);
      }
    }
    if (changed) _set(lines);
  }

  void setRule(DeliveryRule r) {
    if (r.fee == state.rule.fee && r.freeAbove == state.rule.freeAbove) return;
    state = Cart(lines: state.lines, rule: r);
  }
}
