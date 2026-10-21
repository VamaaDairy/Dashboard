import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models.dart';
import '../product_info.dart';
import '../store/cart.dart';
import '../store/distributor.dart';
import '../theme.dart';
import '../widgets.dart';
import 'cart_screen.dart';
import 'subscribe_screen.dart';

/// One product: big swipeable photos, price, highlights, details, nutrition,
/// storage, then more from the same range and other things to try.
class ProductScreen extends ConsumerWidget {
  const ProductScreen({super.key, required this.product});
  final Product product;

  void _open(BuildContext context, Product p) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ProductScreen(product: p)));

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = product;
    final info = infoFor(p);
    final partner = ref.watch(distributorProvider.select((d) => d.signedIn));
    final all = ref.watch(menuProvider.select((c) => c.products));
    final sameRange = [for (final o in all) if (o.sku != p.sku && o.category == p.category) o];
    // one or two from each other category, so the row shows the range rather than six ghees
    final seen = <String, int>{};
    final others = <Product>[];
    for (final o in all) {
      if (o.category == p.category) continue;
      final n = seen.update(o.category, (v) => v + 1, ifAbsent: () => 1);
      if (n <= 2) others.add(o);
      if (others.length >= 10) break;
    }

    return Scaffold(
      backgroundColor: Colors.white,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _Gallery(product: p)),
          SliverToBoxAdapter(child: _Header(product: p)),
          SliverToBoxAdapter(child: _Highlights(items: info.highlights)),
          SliverToBoxAdapter(child: _Details(info: info)),
          if (sameRange.isNotEmpty) SliverToBoxAdapter(child: _Rail(title: 'More in ${p.category}', products: sameRange, onOpen: (o) => _open(context, o))),
          if (others.isNotEmpty) SliverToBoxAdapter(child: _Rail(title: 'You may also like', products: others, onOpen: (o) => _open(context, o))),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CartBar(),
          Container(
            padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.paddingOf(context).bottom),
            decoration: const BoxDecoration(
              color: Colors.white,
              boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -2))],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (p.size != null && p.size!.isNotEmpty) Text(p.size!, style: const TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w600)),
                      PriceTag(product: p, size: 20),
                      if (!partner) const Text('Inclusive of all taxes', style: TextStyle(fontSize: 11, color: Brand.faint)),
                    ],
                  ),
                ),
                if (!partner)
                OutlinedButton(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SubscribeScreen(product: p))),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Brand.accent,
                    minimumSize: const Size(0, 50),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    side: const BorderSide(color: Brand.accent, width: 1.4),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.calendar_month, size: 18),
                    Text('Subscribe', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                  ]),
                ),
                if (!partner) const SizedBox(width: 10),
                AddButton(product: p, large: true, width: 150),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Gallery extends ConsumerStatefulWidget {
  const _Gallery({required this.product});
  final Product product;

  @override
  ConsumerState<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends ConsumerState<_Gallery> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final photos = p.gallery;
    final count = ref.watch(cartProvider.select((c) => c.count));
    final top = MediaQuery.paddingOf(context).top;
    Widget round(IconData icon, String tip, VoidCallback onTap, {int badge = 0}) => Material(
          color: Colors.white,
          shape: const CircleBorder(),
          elevation: 2,
          shadowColor: Colors.black26,
          child: IconButton(
            tooltip: tip,
            onPressed: onTap,
            icon: Badge(isLabelVisible: badge > 0, label: Text('$badge'), backgroundColor: Brand.accent, child: Icon(icon, color: Brand.ink, size: 22)),
          ),
        );

    return Container(
      color: Brand.surface,
      padding: EdgeInsets.only(top: top),
      child: Stack(
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: photos.isEmpty
                ? Hero(tag: 'p-${p.sku}', child: ProductImage(url: null, radius: 0, size: double.infinity))
                : PageView.builder(
                    itemCount: photos.length,
                    onPageChanged: (i) => setState(() => _page = i),
                    itemBuilder: (_, i) {
                      final img = Padding(padding: const EdgeInsets.fromLTRB(36, 56, 36, 36), child: ProductImage(url: photos[i], radius: 0, fit: BoxFit.contain));
                      return i == 0 ? Hero(tag: 'p-${p.sku}', child: img) : img;
                    },
                  ),
          ),
          Positioned(
            left: 12,
            right: 12,
            top: 8,
            child: Row(
              children: [
                round(Icons.arrow_back, 'Back', () => Navigator.of(context).maybePop()),
                const Spacer(),
                round(Icons.shopping_bag_outlined, 'Cart', () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CartScreen())), badge: count),
              ],
            ),
          ),
          if (p.offPercent > 0) Positioned(left: 16, bottom: 16, child: OffBadge(percent: p.offPercent)),
          if (photos.length > 1)
            Positioned(
              left: 0,
              right: 0,
              bottom: 14,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < photos.length; i++)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: i == _page ? 18 : 6,
                      height: 6,
                      decoration: BoxDecoration(color: i == _page ? Brand.accent : Brand.faint.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(3)),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    final p = product;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: Brand.accentTint, borderRadius: BorderRadius.circular(6)),
                child: Text(p.category, style: const TextStyle(color: Brand.accent, fontSize: 12, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(p.name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, height: 1.25, color: Brand.ink)),
          if (p.size != null && p.size!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(p.size!, style: const TextStyle(fontSize: 14, color: Brand.muted, fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              PriceTag(product: p, size: 28),
              if (p.offPercent > 0) ...[
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: Brand.veg.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
                  child: Text('${p.offPercent}% OFF', style: const TextStyle(color: Brand.veg, fontSize: 12, fontWeight: FontWeight.w800)),
                ),
              ],
            ],
          ),
          const SizedBox(height: 2),
          Text(p.offPercent > 0 ? 'MRP ${rupees(p.mrp)} · Inclusive of all taxes' : 'Inclusive of all taxes', style: const TextStyle(fontSize: 12, color: Brand.faint)),
        ],
      ),
    );
  }
}

class _Highlights extends StatelessWidget {
  const _Highlights({required this.items});
  final List<Highlight> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
      decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(16)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final h in items.take(4))
            Expanded(
              child: Column(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                    child: Icon(h.icon, color: Brand.accent, size: 21),
                  ),
                  const SizedBox(height: 6),
                  Text(h.label, textAlign: TextAlign.center, maxLines: 2, style: const TextStyle(fontSize: 11.5, height: 1.2, fontWeight: FontWeight.w600, color: Brand.ink)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// About, nutrition and storage in one small card: three lines of about (tap for more),
/// nutrition folded away, storage on one line.
class _Details extends StatefulWidget {
  const _Details({required this.info});
  final ProductInfo info;

  @override
  State<_Details> createState() => _DetailsState();
}

class _DetailsState extends State<_Details> {
  bool _more = false;

  @override
  Widget build(BuildContext context) {
    final info = widget.info;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
      decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: () => setState(() => _more = !_more),
            child: Text.rich(
              TextSpan(children: [
                TextSpan(text: info.about),
              ]),
              maxLines: _more ? null : 3,
              overflow: _more ? TextOverflow.visible : TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 14, color: Brand.muted, height: 1.45),
            ),
          ),
          if (!_more)
            GestureDetector(
              onTap: () => setState(() => _more = true),
              child: const Padding(padding: EdgeInsets.only(top: 2), child: Text('Read more', style: TextStyle(color: Brand.accent, fontWeight: FontWeight.w700, fontSize: 13))),
            ),
          const SizedBox(height: 6),
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: Material(
              type: MaterialType.transparency,
              child: ExpansionTile(
                tilePadding: EdgeInsets.zero,
                childrenPadding: const EdgeInsets.only(bottom: 8),
                leading: const Icon(Icons.eco_outlined, color: Brand.accent, size: 20),
                title: Text('Nutrition (per ${info.per})', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                children: [_Nutrition(info: info)],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.kitchen_outlined, color: Brand.accent, size: 20),
              const SizedBox(width: 16),
              Expanded(child: Text(info.storage, style: const TextStyle(fontSize: 13, color: Brand.muted, height: 1.4))),
            ]),
          ),
        ],
      ),
    );
  }
}

class _Nutrition extends StatelessWidget {
  const _Nutrition({required this.info});
  final ProductInfo info;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: Brand.line)),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              Container(
                color: Brand.accentTint,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(
                  children: [
                    const Expanded(child: Text('Nutrient', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Brand.accent))),
                    Text('Per ${info.per}', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Brand.accent)),
                  ],
                ),
              ),
              for (var i = 0; i < info.nutrition.length; i++)
                Container(
                  color: i.isOdd ? Brand.surface : Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  child: Row(
                    children: [
                      Expanded(child: Text(info.nutrition[i].$1, style: const TextStyle(fontSize: 13.5, color: Brand.ink))),
                      Text(info.nutrition[i].$2, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: Brand.ink)),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        const Text('Typical values. Please refer to the pack for exact nutrition information.', style: TextStyle(fontSize: 11.5, color: Brand.faint)),
      ],
    );
  }
}

/// A sideways row of product tiles.
class _Rail extends StatelessWidget {
  const _Rail({required this.title, required this.products, required this.onOpen});
  final String title;
  final List<Product> products;
  final void Function(Product) onOpen;

  static const _w = 146.0;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Brand.ink))),
          const SizedBox(height: 12),
          SizedBox(
            height: ProductTile.heightFor(_w),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: products.length,
              separatorBuilder: (_, __) => const SizedBox(width: 14),
              itemBuilder: (_, i) => SizedBox(width: _w, child: ProductTile(product: products[i], onOpen: () => onOpen(products[i]))),
            ),
          ),
        ],
      ),
    );
  }
}
