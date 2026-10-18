import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'models.dart';
import 'screens/cart_screen.dart';
import 'state/cart_state.dart';
import 'theme.dart';

/// The green "vegetarian" mark. Everything Gaia sells is.
class VegDot extends StatelessWidget {
  const VegDot({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 16,
      height: 16,
      decoration: BoxDecoration(
        border: Border.all(color: Brand.veg, width: 1.5),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Center(
        child: Container(
          width: 8,
          height: 8,
          decoration: const BoxDecoration(color: Brand.veg, shape: BoxShape.circle),
        ),
      ),
    );
  }
}

/// A product photo, or a soft placeholder when there isn't one (or it can't load).
class ProductImage extends StatelessWidget {
  const ProductImage({super.key, required this.url, this.size, this.radius = 16, this.circle = false, this.fit = BoxFit.cover});

  final String? url;
  final double? size;
  final double radius;
  final bool circle;
  final BoxFit fit;

  Widget _placeholder() => Container(
        decoration: const BoxDecoration(
          color: Brand.surface,
        ),
        alignment: Alignment.center,
        child: Opacity(opacity: 0.35, child: Image.asset('assets/images/gaia-logo.jpg', width: (size ?? 80) * 0.5, fit: BoxFit.contain)),
      );

  @override
  Widget build(BuildContext context) {
    final Widget img = url == null || url!.isEmpty
        ? _placeholder()
        : CachedNetworkImage(
            imageUrl: url!,
            fit: fit,
            placeholder: (_, __) => Container(color: Brand.surface),
            errorWidget: (_, __, ___) => _placeholder(),
          );
    final sized = SizedBox(width: size, height: size, child: img);
    return circle ? ClipOval(child: sized) : ClipRRect(borderRadius: BorderRadius.circular(radius), child: sized);
  }
}

/// ADD, which becomes a  -  1  +  stepper once the item is in the cart.
/// [large] is the product page's solid "Add to cart".
class AddButton extends StatelessWidget {
  const AddButton({super.key, required this.product, this.large = false, this.width});

  final Product product;
  final bool large;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartState>();
    final qty = cart.qtyOf(product.sku);
    final w = width ?? (large ? 160.0 : 76.0);
    final h = large ? 50.0 : 34.0;
    final r = BorderRadius.circular(large ? 14 : 9);

    if (qty == 0) {
      if (large) {
        return SizedBox(
          width: w,
          height: h,
          child: FilledButton.icon(
            onPressed: () => cart.add(product),
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
          onTap: () => cart.add(product),
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
          Text('$qty', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: large ? 18 : 15)),
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

/// Selling price, with the MRP struck through and the saving when there is one.
class PriceTag extends StatelessWidget {
  const PriceTag({super.key, required this.product, this.size = 16});
  final Product product;
  final double size;

  @override
  Widget build(BuildContext context) {
    final p = product;
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.end,
      spacing: 6,
      children: [
        Text(rupees(p.price), style: TextStyle(fontSize: size, fontWeight: FontWeight.w800, color: Brand.ink, height: 1.1)),
        if (p.offPercent > 0) Text(rupees(p.mrp), style: TextStyle(fontSize: size * 0.72, color: Brand.faint, decoration: TextDecoration.lineThrough, height: 1.3)),
      ],
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
        child: Text('$percent% OFF', style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.2)),
      );
}

/// A compact product tile: photo with ADD on its corner, then name, size and price.
/// Used in the menu grid and the "you may also like" rows.
class ProductTile extends StatelessWidget {
  const ProductTile({super.key, required this.product, required this.onOpen});
  final Product product;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final p = product;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onOpen,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: Brand.line.withValues(alpha: 0.6))),
                    padding: const EdgeInsets.fromLTRB(8, 10, 8, 16),
                    child: Hero(tag: 'p-${p.sku}', child: ProductImage(url: p.image, radius: 0, fit: BoxFit.contain)),
                  ),
                ),
                if (p.offPercent > 0) Positioned(top: 0, left: 0, child: OffBadge(percent: p.offPercent)),
                const Positioned(top: 8, right: 8, child: VegDot()),
                // ADD sits on the photo's corner so it is always in the same place
                Positioned(right: 6, bottom: -14, child: AddButton(product: p)),
              ],
            ),
          ),
          const SizedBox(height: 20),
          if (p.size != null && p.size!.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(5)),
              child: Text(p.size!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: Brand.muted, fontWeight: FontWeight.w600)),
            ),
          const SizedBox(height: 5),
          SizedBox(
            height: 34,
            child: Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, height: 1.3, color: Brand.ink)),
          ),
          const SizedBox(height: 4),
          PriceTag(product: p),
        ],
      ),
    );
  }
}

/// The red bar at the bottom once something is in the cart.
class CartBar extends StatelessWidget {
  const CartBar({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartState>();
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
                      Text('${rupees(cart.subtotal)}  plus delivery',
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

/// "Bill details" box, shared by the cart and checkout.
class BillDetails extends StatelessWidget {
  const BillDetails({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartState>();
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
          row(
            'Delivery fee',
            cart.delivery == 0
                ? const Text('FREE', style: TextStyle(color: Brand.veg, fontWeight: FontWeight.w700))
                : Text(rupees(cart.delivery)),
          ),
          const Divider(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('To pay', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              Text(rupees(cart.total), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ],
          ),
          if (cart.toFreeDelivery > 0)
            Container(
              margin: const EdgeInsets.only(top: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: Brand.accentTint, borderRadius: BorderRadius.circular(8)),
              child: Text('Add items worth ${rupees(cart.toFreeDelivery)} more for free delivery',
                  style: const TextStyle(color: Brand.accent, fontSize: 12, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }
}
