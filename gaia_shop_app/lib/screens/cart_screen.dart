import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models.dart';
import '../store/cart.dart';
import '../store/catalog.dart';
import '../theme.dart';
import '../widgets.dart';
import 'checkout_screen.dart';
import 'customer_login_screen.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);

    if (cart.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Your cart')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('🛒', style: TextStyle(fontSize: 64)),
                const SizedBox(height: 12),
                const Text('Your cart is empty', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                const Text('Good food is always cooking. Go ahead, order some yummy items from the menu.', textAlign: TextAlign.center, style: TextStyle(color: Brand.muted)),
                const SizedBox(height: 20),
                FilledButton(onPressed: () => Navigator.of(context).pop(), style: FilledButton.styleFrom(minimumSize: const Size(180, 48)), child: const Text('Browse products')),
              ],
            ),
          ),
        ),
      );
    }

    final menu = ref.read(catalogProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Your cart')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(16)),
            child: Column(
              children: [
                for (final (i, l) in cart.lines.indexed)
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(border: i == cart.lines.length - 1 ? null : const Border(bottom: BorderSide(color: Brand.line))),
                    child: Row(
                      children: [
                        ProductImage(url: l.image, size: 56, radius: 12),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(l.name, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, height: 1.25)),
                              if (l.size != null) Text(l.size!, style: const TextStyle(fontSize: 12, color: Brand.muted)),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            AddButton(product: menu.bySku(l.sku) ?? _asProduct(l)),
                            const SizedBox(height: 6),
                            Text(rupees(l.total), style: const TextStyle(fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          Center(
            child: TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('+ Add more items', style: TextStyle(color: Brand.accent, fontWeight: FontWeight.w700)),
            ),
          ),
          const BillDetails(),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: Brand.line))),
          child: FilledButton(
            // the cart works without an account; placing the order needs one
            onPressed: () async {
              final nav = Navigator.of(context);
              if (!await CustomerLoginScreen.ensure(context, reason: 'Sign in or create an account to place your order. Your cart is saved.')) return;
              nav.push(MaterialPageRoute<void>(builder: (_) => const CheckoutScreen()));
            },
            child: Text('Proceed to checkout · ${rupees(cart.total)}'),
          ),
        ),
      ),
    );
  }

  /// If the menu hasn't loaded (offline), the cart can still be edited from what it remembers.
  Product _asProduct(CartLine l) =>
      Product(sku: l.sku, name: l.name, category: '', subCategory: '', mrp: l.price, price: l.price, size: l.size, image: l.image);
}
