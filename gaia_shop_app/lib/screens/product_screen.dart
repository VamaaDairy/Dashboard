import 'package:flutter/material.dart';

import '../models.dart';
import '../theme.dart';
import '../widgets.dart';

class ProductScreen extends StatelessWidget {
  const ProductScreen({super.key, required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    final p = product;
    final off = p.mrp > p.price ? ((p.mrp - p.price) / p.mrp * 100).round() : 0;
    return Scaffold(
      appBar: AppBar(),
      body: ListView(
        children: [
          AspectRatio(aspectRatio: 1, child: ProductImage(url: p.image, radius: 0)),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const VegDot(),
                const SizedBox(height: 8),
                Text(p.name, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, height: 1.2)),
                const SizedBox(height: 4),
                Text([p.category, if (p.size != null) p.size!].join(' · '), style: const TextStyle(color: Brand.muted)),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(rupees(p.price), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                    if (off > 0) ...[
                      const SizedBox(width: 10),
                      Text(rupees(p.mrp), style: const TextStyle(color: Brand.faint, decoration: TextDecoration.lineThrough)),
                      const SizedBox(width: 8),
                      Text('$off% off', style: const TextStyle(color: Brand.veg, fontWeight: FontWeight.w800)),
                    ],
                  ],
                ),
                if (p.description != null) ...[
                  const SizedBox(height: 16),
                  Text(p.description!, style: const TextStyle(fontSize: 15, color: Brand.muted, height: 1.45)),
                ],
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: Brand.line))),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(rupees(p.price), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              AddButton(product: p, large: true),
            ],
          ),
        ),
      ),
    );
  }
}
