import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models.dart';
import '../store/catalog.dart';
import '../theme.dart';
import '../ui.dart';
import '../widgets.dart';
import 'product_screen.dart';

/// The Products tab: categories down the left, the chosen category's products in a grid on the right.
/// Search looks through every category.
class ProductsScreen extends ConsumerStatefulWidget {
  const ProductsScreen({super.key, required this.category, required this.onCategory, required this.onRetry});

  /// The chosen category; null means the first one.
  final String? category;
  final ValueChanged<String> onCategory;
  final Future<void> Function() onRetry;

  @override
  ConsumerState<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends ConsumerState<ProductsScreen> {
  static const _railWidth = 88.0;
  final _search = TextEditingController();
  bool _searchOpen = false;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _closeSearch() => setState(() {
        _searchOpen = false;
        _search.clear();
      });

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(catalogProvider);
    final categories = catalog.categories;
    final current = categories.any((c) => c.name == widget.category) ? widget.category! : (categories.isEmpty ? null : categories.first.name);
    final term = _search.text.trim().toLowerCase();
    final shown = term.isNotEmpty
        ? catalog.products.where((p) => '${p.name} ${p.category} ${p.subCategory}'.toLowerCase().contains(term)).toList()
        : catalog.products.where((p) => p.category == current).toList();

    return SafeArea(
      bottom: false,
      child: Column(children: [
        // top bar: title and search
        SizedBox(
          height: 64,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 8, 0),
            child: _searchOpen
                ? TextField(
                    controller: _search,
                    autofocus: true,
                    onChanged: (_) => setState(() {}),
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      hintText: 'Search all products',
                      suffixIcon: IconButton(icon: const Icon(Icons.close_rounded), tooltip: 'Close search', onPressed: _closeSearch),
                    ),
                  )
                : Row(children: [
                    Expanded(
                      child: Text(term.isEmpty ? (current ?? 'Products') : 'Products',
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.2)),
                    ),
                    Material(
                      color: Brand.surface,
                      shape: const CircleBorder(),
                      child: IconButton(tooltip: 'Search', onPressed: () => setState(() => _searchOpen = true), icon: const Icon(Icons.search_rounded, size: 24)),
                    ),
                  ]),
          ),
        ),
        const Divider(height: 1, color: Brand.line),
        Expanded(child: _body(catalog, categories, current, shown, term)),
      ]),
    );
  }

  Widget _body(CatalogData catalog, List<MenuCategory> categories, String? current, List<Product> shown, String term) {
    if (catalog.catalog == null) {
      if (catalog.loading || catalog.error == null) return const Center(child: CircularProgressIndicator(color: Brand.accent));
      return Center(child: EmptyState(icon: Icons.wifi_off_rounded, title: 'No connection', message: catalog.error, action: 'Try again', onAction: widget.onRetry));
    }
    final gridW = MediaQuery.sizeOf(context).width - _railWidth - 1;
    final cardW = gridW - 12 * 2;

    return Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      // the category rail
      SizedBox(
        width: _railWidth,
        child: ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: categories.length,
          itemBuilder: (_, i) {
            final c = categories[i];
            return _RailItem(
              category: c,
              selected: term.isEmpty && c.name == current,
              onTap: () {
                if (_searchOpen) _closeSearch();
                widget.onCategory(c.name);
              },
            );
          },
        ),
      ),
      const VerticalDivider(width: 1, color: Brand.line),
      Expanded(
        child: RefreshIndicator(
          color: Brand.accent,
          onRefresh: () => ref.read(catalogProvider.notifier).load(force: true),
          child: shown.isEmpty
              ? ListView(children: [
                  const SizedBox(height: 60),
                  EmptyState(
                    icon: Icons.search_off_rounded,
                    title: 'Nothing found',
                    message: term.isEmpty ? 'No products in this category yet.' : 'No product matches "${_search.text.trim()}".',
                  ),
                ])
              : ListView.separated(
                  // a new category starts at its top
                  key: ValueKey('products-${term.isEmpty ? current : 'search'}'),
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 28),
                  // one product per row: photo on the left, the name with its quantity under it on the right
                  itemCount: shown.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, i) => ProductRowCard(
                    product: shown[i],
                    width: cardW,
                    onOpen: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ProductScreen(product: shown[i]))),
                  ),
                ),
        ),
      ),
    ]);
  }
}

/// One category in the rail: its photo in a rounded box (outlined in blue when chosen), the name below.
class _RailItem extends StatelessWidget {
  const _RailItem({required this.category, required this.selected, required this.onTap});
  final MenuCategory category;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Stack(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 10),
            child: Column(children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                width: 64,
                height: 64,
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  color: selected ? Brand.accentTint : Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: selected ? Brand.accent : Brand.line, width: selected ? 1.6 : 1),
                ),
                child: ProductImage(url: category.image, radius: 10, fit: BoxFit.contain),
              ),
              const SizedBox(height: 6),
              Text(
                category.name,
                maxLines: 2,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12, height: 1.15, fontWeight: selected ? FontWeight.w800 : FontWeight.w600, color: selected ? Brand.accent : Brand.ink),
              ),
            ]),
          ),
          // a blue bar on the right edge marks the chosen one
          if (selected)
            Positioned(
              right: 0,
              top: 14,
              child: Container(width: 3.5, height: 52, decoration: const BoxDecoration(color: Brand.accent, borderRadius: BorderRadius.horizontal(left: Radius.circular(3)))),
            ),
        ]),
      );
}
