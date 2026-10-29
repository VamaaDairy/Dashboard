import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'models.dart';
import 'screens/cart_screen.dart';
import 'store/cart.dart';
import 'store/distributor.dart';
import 'theme.dart';

/// A product photo, or a soft placeholder when there isn't one (or it can't load).
class ProductImage extends StatelessWidget {
  const ProductImage({super.key, required this.url, this.size, this.radius = 16, this.circle = false, this.fit = BoxFit.cover, this.outlined = false});

  final String? url;
  final double? size;
  final double radius;
  final bool circle;
  final BoxFit fit;

  /// A hairline round a small thumbnail, so a white pack shot still reads as a picture on a white page.
  final bool outlined;

  Widget _placeholder() => Container(
        // white, like the pack shots themselves
        decoration: const BoxDecoration(
          color: Colors.white,
        ),
        alignment: Alignment.center,
        // the logo stays small whatever the box: half a small box, at most 110 px wide
        child: Opacity(
          opacity: 0.35,
          child: Image.asset('assets/images/gaia-logo.jpg', width: (size == null || !size!.isFinite) ? 110 : (size! * 0.5).clamp(16, 110).toDouble(), fit: BoxFit.contain),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final Widget img = url == null || url!.isEmpty
        ? _placeholder()
        : LayoutBuilder(builder: (context, box) {
            // decode at the size it is shown (rounded up to steps of 200 px so the same photo in a
            // tile and a rail shares one decoded copy) instead of the full-resolution original
            final w = (box.maxWidth.isFinite ? box.maxWidth : (size ?? 400)) * MediaQuery.devicePixelRatioOf(context);
            final px = ((w / 200).ceil() * 200).clamp(200, 1600);
            return CachedNetworkImage(
              imageUrl: url!,
              fit: fit,
              memCacheWidth: px,
              fadeInDuration: const Duration(milliseconds: 150),
              placeholder: (_, __) => Container(color: Colors.white),
              errorWidget: (_, __, ___) => _placeholder(),
            );
          });
    final sized = SizedBox(width: size, height: size, child: ColoredBox(color: Colors.white, child: img));
    if (circle) return ClipOval(child: sized);
    final clipped = ClipRRect(borderRadius: BorderRadius.circular(radius), child: sized);
    if (!outlined) return clipped;
    return DecoratedBox(
      position: DecorationPosition.foreground,
      decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(radius)),
      child: clipped,
    );
  }
}

/// ADD, which becomes a  -  1  +  stepper once the item is in the cart.
/// [large] is the product page's solid "Add to cart".
class AddButton extends ConsumerWidget {
  const AddButton({super.key, required this.product, this.large = false, this.width});

  final Product product;
  final bool large;
  final double? width;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // only this product's quantity: the button rebuilds when it changes, not for every cart change
    final qty = ref.watch(cartProvider.select((c) => c.qtyOf(product.sku)));
    final cart = ref.read(cartProvider.notifier);
    final w = width ?? (large ? 160.0 : 76.0);
    final h = large ? 50.0 : 34.0;
    final r = BorderRadius.circular(large ? 14 : 9);

    if (qty == 0) {
      if (large) {
        return SizedBox(
          width: w,
          height: h,
          child: FilledButton.icon(
            onPressed: () {
              HapticFeedback.lightImpact();
              cart.add(product);
            },
            style: FilledButton.styleFrom(minimumSize: Size(w, h), shape: RoundedRectangleBorder(borderRadius: r), padding: EdgeInsets.zero),
            icon: const Icon(Icons.add_shopping_cart, size: 20),
            label: const Text('Add to cart'),
          ),
        );
      }
      return Material(
        color: Colors.white,
        borderRadius: r,
        elevation: 2,
        shadowColor: Colors.black26,
        child: InkWell(
          onTap: () {
            HapticFeedback.lightImpact();
            cart.add(product);
          },
          borderRadius: r,
          child: Container(
            width: w,
            height: h,
            alignment: Alignment.center,
            decoration: BoxDecoration(borderRadius: r, border: Border.all(color: Brand.accent, width: 1.2)),
            child: const Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                Text('ADD', style: TextStyle(color: Brand.accent, fontWeight: FontWeight.w800, fontSize: 14, letterSpacing: 0.6)),
                Positioned(right: -14, top: -6, child: Text('+', style: TextStyle(color: Brand.accent, fontWeight: FontWeight.w800, fontSize: 13))),
              ],
            ),
          ),
        ),
      );
    }
    return Container(
      width: w,
      height: h,
      decoration: BoxDecoration(
        color: Brand.accent,
        borderRadius: r,
        boxShadow: const [BoxShadow(color: Color(0x2E000000), blurRadius: 8, offset: Offset(0, 2))],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _step(Icons.remove, () => cart.setQty(product.sku, qty - 1), 'Remove one'),
          Flexible(
            child: InkWell(
              // partners order in cases: tap the number to type it
              onTap: () async {
                final n = await _askQty(context, product.name, qty);
                if (n != null) cart.setQty(product.sku, n);
              },
              child: Text('$qty', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: large ? 18 : 15)),
            ),
          ),
          _step(Icons.add, () => cart.add(product), 'Add one more'),
        ],
      ),
    );
  }

  Widget _step(IconData icon, VoidCallback onTap, String label) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Semantics(
          button: true,
          label: label,
          child: SizedBox(width: large ? 48 : 26, height: double.infinity, child: Icon(icon, color: Colors.white, size: large ? 22 : 16)),
        ),
      );
}

Future<int?> _askQty(BuildContext context, String name, int current) {
  final c = TextEditingController(text: '$current');
  return showDialog<int>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(name, maxLines: 2, overflow: TextOverflow.ellipsis),
      content: TextField(controller: c, autofocus: true, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity')),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(ctx, int.tryParse(c.text.trim()) ?? current), child: const Text('OK')),
      ],
    ),
  );
}

/// A distributor / retailer sees their own price beside the MRP; a sales officer only the MRP.
class PriceTag extends ConsumerWidget {
  const PriceTag({super.key, required this.product, this.size = 16});
  final Product product;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = product;
    final kind = ref.watch(distributorProvider.select((d) => d.profile?.kind));
    // a dealer's price card: their price and the MRP side by side, both in bold black, each with a
    // small label under it, split by a hairline - easy to compare at a glance
    final salesman = kind == 'salesman';
    final value = TextStyle(fontSize: size, fontWeight: FontWeight.w800, color: Brand.ink, height: 1.1, letterSpacing: -0.2);
    final label = TextStyle(fontSize: (size * 0.62).clamp(10, 14).toDouble(), fontWeight: FontWeight.w600, color: Brand.muted, height: 1.3);
    Widget figure(String v, String l) => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [Text(v, maxLines: 1, style: value), Text(l, maxLines: 1, style: label)],
        );
    if (salesman) return figure(rupees(p.mrp), 'MRP');
    // never cut a price off: on a narrow tile or with large phone text the card shrinks to fit
    return FittedBox(
      fit: BoxFit.scaleDown,
      alignment: Alignment.centerLeft,
      child: IntrinsicHeight(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            figure(rupees(p.price), 'Your price'),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: size * 0.6),
              child: const VerticalDivider(width: 1, thickness: 1, color: Brand.line),
            ),
            figure(rupees(p.mrp), 'MRP'),
          ],
        ),
      ),
    );
  }
}

/// "12% OFF" ribbon for the corner of a product photo.
class OffBadge extends StatelessWidget {
  const OffBadge({super.key, required this.percent});
  final int percent;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: const BoxDecoration(color: Brand.gaiaGreen, borderRadius: BorderRadius.only(topLeft: Radius.circular(10), bottomRight: Radius.circular(10))),
        child: Text('$percent% MARGIN', style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.2)),
      );
}

/// A compact product tile: photo with ADD on its corner, then name, size and price.
/// Used in the menu grid and the "you may also like" rows.
class ProductTile extends ConsumerWidget {
  const ProductTile({super.key, required this.product, required this.onOpen});

  /// The height a tile [width] wide needs: its photo plus room for size, two lines of name, price.
  static double heightFor(double width) => (width - 12) / 1.08 + 150;
  final Product product;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = product;
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: Brand.line)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 1.08,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned.fill(
                      child: Container(
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                        padding: const EdgeInsets.fromLTRB(10, 10, 10, 18),
                        child: Hero(tag: 'p-${p.sku}', child: ProductImage(url: p.image, radius: 0, fit: BoxFit.contain)),
                      ),
                    ),
                    if (p.offPercent > 0) Positioned(top: 0, left: 0, child: OffBadge(percent: p.offPercent)),
                    // ADD sits on the photo's corner so it is always in the same place
                    Positioned(right: 6, bottom: -14, child: AddButton(product: p)),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(6, 20, 6, 0),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  // the name, then its quantity (500 ml, 1 Ltr) under it
                  SizedBox(
                    height: 36,
                    // two lines normally; with large phone text only whole lines, never half of one
                    child: Text(p.name,
                        maxLines: (36 / MediaQuery.textScalerOf(context).scale(13.5 * 1.3)).floor().clamp(1, 2),
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, height: 1.3, color: Brand.ink)),
                  ),
                  SizedBox(
                    height: 18,
                    child: (p.size != null && p.size!.isNotEmpty)
                        ? Text(p.size!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w600))
                        : null,
                  ),
                  const SizedBox(height: 6),
                  PriceTag(product: p),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The red bar at the bottom once something is in the cart.
class CartBar extends ConsumerWidget {
  const CartBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    if (cart.count == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Material(
        color: Brand.accent,
        borderRadius: BorderRadius.circular(16),
        elevation: 6,
        shadowColor: Brand.accent.withValues(alpha: 0.5),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${cart.count} ${cart.count == 1 ? 'ITEM' : 'ITEMS'}',
                          style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
                      Text(rupees(cart.subtotal),
                          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
                const Text('View cart', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                const Icon(Icons.chevron_right, color: Colors.white),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// "Bill details" box on the cart.
class BillDetails extends ConsumerWidget {
  const BillDetails({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    Widget row(String l, Widget r) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(l, style: const TextStyle(color: Brand.muted)), r]),
        );
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Bill details', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 8),
          row('Item total', Text(rupees(cart.subtotal))),
          const Divider(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Order total', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              Text(rupees(cart.subtotal), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ],
          ),
        ],
      ),
    );
  }
}
