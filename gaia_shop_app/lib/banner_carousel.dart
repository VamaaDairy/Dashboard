import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'models.dart';
import 'screens/product_screen.dart';
import 'store/catalog.dart';
import 'theme.dart';
import 'widgets.dart';

/// The swipeable strip at the top of the menu: posters and product spotlights,
/// managed from the dashboard (Shop orders → Banners). Turns on its own every few seconds.
class BannerCarousel extends StatefulWidget {
  const BannerCarousel({super.key, required this.banners});
  final List<ShopBanner> banners;

  @override
  State<BannerCarousel> createState() => _BannerCarouselState();
}

class _BannerCarouselState extends State<BannerCarousel> {
  final _pages = PageController(viewportFraction: 0.92);
  Timer? _timer;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _restart();
  }

  @override
  void didUpdateWidget(BannerCarousel old) {
    super.didUpdateWidget(old);
    if (old.banners.length != widget.banners.length) {
      _index = 0;
      if (_pages.hasClients) _pages.jumpToPage(0);
      _restart();
    }
  }

  void _restart() {
    _timer?.cancel();
    if (widget.banners.length < 2) return;
    _timer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!_pages.hasClients) return;
      final next = (_index + 1) % widget.banners.length;
      _pages.animateToPage(next, duration: const Duration(milliseconds: 450), curve: Curves.easeOutCubic);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final banners = widget.banners;
    if (banners.isEmpty) return const SizedBox.shrink();
    final height = ((MediaQuery.sizeOf(context).width * 0.92) / 1.9).clamp(160.0, 280.0);
    return Column(
      children: [
        SizedBox(
          height: height,
          // a finger on the strip pauses the auto-turn until it lets go
          child: Listener(
            onPointerDown: (_) => _timer?.cancel(),
            onPointerUp: (_) => _restart(),
            onPointerCancel: (_) => _restart(),
            child: PageView.builder(
              controller: _pages,
              itemCount: banners.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (_, i) => Padding(padding: const EdgeInsets.symmetric(horizontal: 5), child: _Slide(banner: banners[i])),
            ),
          ),
        ),
        if (banners.length > 1) ...[
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < banners.length; i++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _index ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(color: i == _index ? Brand.accent : Brand.line, borderRadius: BorderRadius.circular(3)),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _Slide extends ConsumerWidget {
  const _Slide({required this.banner});
  final ShopBanner banner;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final b = banner;
    final product = b.sku == null ? null : ref.watch(catalogProvider.select((c) => c.bySku(b.sku!)));
    void open() {
      if (product != null) Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ProductScreen(product: product)));
    }

    final Widget body = b.image != null
        ? CachedNetworkImage(
            imageUrl: b.image!,
            fit: BoxFit.cover,
            placeholder: (_, __) => ColoredBox(color: b.bgColor.withValues(alpha: 0.15)),
            errorWidget: (_, __, ___) => _Card(banner: b, product: product),
          )
        : _Card(banner: b, product: product);

    return GestureDetector(
      onTap: product == null ? null : open,
      child: ClipRRect(borderRadius: BorderRadius.circular(22), child: body),
    );
  }
}

/// A designed slide in the Gaia story style: a blue card cut by a deeper diagonal,
/// a big white headline, and either the brand mark or a phone peeking up with the product in it.
class _Card extends StatelessWidget {
  const _Card({required this.banner, required this.product});
  final ShopBanner banner;
  final Product? product;

  @override
  Widget build(BuildContext context) {
    final b = banner;
    final p = product;
    final hsl = HSLColor.fromColor(b.bgColor);
    final deep = hsl.withLightness((hsl.lightness - 0.15).clamp(0.0, 1.0)).withSaturation((hsl.saturation - 0.15).clamp(0.0, 1.0)).toColor();

    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (p == null) ...[
          // the brand mark, like the opening story card
          Container(
            width: 42,
            height: 42,
            padding: const EdgeInsets.all(5),
            decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
            child: Image.asset('assets/images/gaia-logo.jpg', fit: BoxFit.contain),
          ),
          const SizedBox(height: 10),
        ],
        Text(b.title,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Colors.white, fontSize: 20, height: 1.12, fontWeight: FontWeight.w500, letterSpacing: -0.4)),
        if (b.subtitle != null && b.subtitle!.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(b.subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12, height: 1.3)),
        ],
        if (b.cta != null && b.cta!.isNotEmpty) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
            child: Text(b.cta!, style: TextStyle(color: deep, fontSize: 12, fontWeight: FontWeight.w700)),
          ),
        ],
      ],
    );

    return ColoredBox(
      color: b.bgColor,
      child: LayoutBuilder(builder: (_, box) {
        final w = box.maxWidth, h = box.maxHeight;
        return Stack(
          clipBehavior: Clip.hardEdge,
          children: [
            Positioned.fill(child: CustomPaint(painter: _Diagonal(deep, wide: p != null))),
            if (p != null)
              // the phone rises out of the bottom edge, cut off like in the store screenshots
              Positioned(right: w * 0.06, top: h * 0.1, bottom: -h * 0.2, width: w * 0.32, child: _Phone(product: p, hidden: h * 0.2)),
            Positioned(
              left: 18,
              top: 14,
              bottom: 14,
              width: p != null ? w * 0.54 : w * 0.6,
              child: text,
            ),
          ],
        );
      }),
    );
  }
}

/// The deeper-blue sweep: comes in from the right edge and turns on a soft rounded corner.
class _Diagonal extends CustomPainter {
  _Diagonal(this.color, {required this.wide});
  final Color color;

  /// Behind a phone the sweep starts further left; on a text-only card it keeps clear of the words.
  final bool wide;

  @override
  void paint(Canvas canvas, Size s) {
    final w = s.width, h = s.height;
    final x = wide ? 0.0 : 0.1;
    final path = Path()
      ..moveTo(w, h * 0.22)
      ..lineTo(w * (0.6 + x), h * 0.52)
      ..quadraticBezierTo(w * (0.5 + x), h * 0.60, w * (0.57 + x), h * 0.72)
      ..lineTo(w * (0.74 + x), h)
      ..lineTo(w, h)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
    // the thin light band across the top-left corner
    final band = Path()
      ..moveTo(0, h * 0.30)
      ..lineTo(w * 0.10, 0)
      ..lineTo(w * 0.15, 0)
      ..lineTo(0, h * 0.46)
      ..close();
    canvas.drawPath(band, Paint()..color = Colors.white.withValues(alpha: 0.12));
  }

  @override
  bool shouldRepaint(_Diagonal old) => old.color != color || old.wide != wide;
}

/// A small phone frame showing the product the way the app's menu does: photo, name, size, price.
class _Phone extends StatelessWidget {
  const _Phone({required this.product, required this.hidden});
  final Product product;

  /// How much of the phone hangs below the banner; its content stops above that.
  final double hidden;

  @override
  Widget build(BuildContext context) {
    final p = product;
    return Container(
      padding: const EdgeInsets.all(3.5),
      decoration: BoxDecoration(
        color: const Color(0xFF1B1B1F),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 14, offset: const Offset(0, 6))],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(19),
        child: ColoredBox(
          color: Colors.white,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 5),
              // the dynamic island
              Center(child: Container(width: 30, height: 8, decoration: BoxDecoration(color: const Color(0xFF1B1B1F), borderRadius: BorderRadius.circular(4)))),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: Center(child: ProductImage(url: p.image, radius: 0, fit: BoxFit.contain))),
                      const SizedBox(height: 4),
                      Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 8.5, height: 1.2, fontWeight: FontWeight.w600, color: Brand.ink)),
                      Row(
                        children: [
                          if (p.size != null) Flexible(child: Text(p.size!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 8, color: Brand.muted))),
                          const Spacer(),
                          Text(rupees(p.price), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Brand.ink)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Container(
                        height: 14,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: Brand.accent, borderRadius: BorderRadius.circular(7)),
                        child: const Text('Add to cart', style: TextStyle(color: Colors.white, fontSize: 7, fontWeight: FontWeight.w700)),
                      ),
                      SizedBox(height: hidden + 6),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
