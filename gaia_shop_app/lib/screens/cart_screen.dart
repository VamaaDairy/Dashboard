import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models.dart';
import '../store/cart.dart';
import '../store/catalog.dart';
import '../theme.dart';
import '../ui.dart';
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
        appBar: AppBar(title: const Text('Cart')),
        body: Center(
          child: EmptyState(
            icon: Icons.shopping_bag_outlined,
            title: 'Your cart is empty',
            message: 'Fresh milk, paneer, dahi and ghee are a tap away.',
            action: 'Start shopping',
            onAction: () => Navigator.of(context).pop(),
          ),
        ),
      );
    }

    final menu = ref.read(catalogProvider);
    return Scaffold(
      backgroundColor: Brand.surface,
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Cart'),
          Text('${cart.count} ${cart.count == 1 ? 'item' : 'items'}', style: const TextStyle(fontSize: 12.5, color: Brand.muted, fontWeight: FontWeight.w600)),
        ]),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          _FreeDelivery(cart: cart),
          const SizedBox(height: 12),
          for (final l in cart.lines)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: AppCard(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  Container(
                    width: 68,
                    height: 68,
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(14)),
                    child: ProductImage(url: l.image, radius: 0, fit: BoxFit.contain),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(l.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, height: 1.25)),
                      const SizedBox(height: 2),
                      Text([if (l.size != null) l.size!, '${rupees(l.price)} each'].join(' · '), style: const TextStyle(fontSize: 12.5, color: Brand.muted)),
                      const SizedBox(height: 6),
                      Text(rupees(l.total), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                    ]),
                  ),
                  const SizedBox(width: 8),
                  AddButton(product: menu.bySku(l.sku) ?? _asProduct(l)),
                ]),
              ),
            ),
          Center(
            child: TextButton.icon(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.add_circle_outline_rounded, size: 20),
              label: const Text('Add more items'),
            ),
          ),
          const SizedBox(height: 4),
          const BillDetails(),
          const SizedBox(height: 12),
          const Row(children: [
            Icon(Icons.verified_user_outlined, size: 18, color: Brand.veg),
            SizedBox(width: 8),
            Expanded(child: Text('Pay cash when your order arrives. Prices include all taxes.', style: TextStyle(fontSize: 12.5, color: Brand.muted))),
          ]),
        ],
      ),
      bottomNavigationBar: StickyBar(
        child: Row(children: [
          Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(rupees(cart.total), style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
            const Text('Total to pay', style: TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(width: 16),
          Expanded(
            child: FilledButton(
              // the cart works without an account; placing the order needs one
              onPressed: () async {
                final nav = Navigator.of(context);
                if (!await CustomerLoginScreen.ensure(context, reason: 'Sign in or create an account to place your order. Your cart is saved.')) return;
                nav.push(MaterialPageRoute<void>(builder: (_) => const CheckoutScreen()));
              },
              child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [Text('Checkout'), SizedBox(width: 6), Icon(Icons.arrow_forward_rounded, size: 20)]),
            ),
          ),
        ]),
      ),
    );
  }

  /// If the menu hasn't loaded (offline), the cart can still be edited from what it remembers.
  Product _asProduct(CartLine l) =>
      Product(sku: l.sku, name: l.name, category: '', subCategory: '', mrp: l.price, price: l.price, size: l.size, image: l.image);
}

/// How close the cart is to free delivery, with a bar; or the good news that it's free.
class _FreeDelivery extends StatelessWidget {
  const _FreeDelivery({required this.cart});
  final Cart cart;

  @override
  Widget build(BuildContext context) {
    final rule = cart.rule;
    if (rule.fee <= 0 && rule.freeAbove <= 0) {
      return const _Banner(icon: Icons.local_shipping_outlined, text: 'Free delivery on every order', color: Brand.veg);
    }
    final left = cart.toFreeDelivery;
    if (left <= 0) return const _Banner(icon: Icons.celebration_outlined, text: 'Yay! You get free delivery', color: Brand.veg);
    final progress = (cart.subtotal / rule.freeAbove).clamp(0.0, 1.0);
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.local_shipping_outlined, size: 20, color: Brand.accent),
          const SizedBox(width: 8),
          Expanded(
            child: Text.rich(TextSpan(children: [
              const TextSpan(text: 'Add '),
              TextSpan(text: rupees(left), style: const TextStyle(fontWeight: FontWeight.w900, color: Brand.accent)),
              const TextSpan(text: ' more for '),
              const TextSpan(text: 'FREE delivery', style: TextStyle(fontWeight: FontWeight.w900, color: Brand.veg)),
            ]), style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
          ),
        ]),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(value: progress, minHeight: 7, backgroundColor: Brand.accentTint, color: Brand.accent),
        ),
      ]),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.icon, required this.text, required this.color});
  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(Brand.radius)),
        child: Row(children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(width: 8),
          Text(text, style: TextStyle(fontWeight: FontWeight.w800, color: color)),
        ]),
      );
}
