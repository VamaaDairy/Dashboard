import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../banner_carousel.dart';
import '../config.dart';
import '../models.dart';
import '../store/account.dart';
import '../store/cart.dart';
import '../store/catalog.dart';
import '../theme.dart';
import '../widgets.dart';
import 'account_screen.dart';
import 'cart_screen.dart';
import 'orders_screen.dart';
import 'product_screen.dart';

/// The app's frame: the menu and "My orders", with the cart bar floating above the tabs.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> with WidgetsBindingObserver {
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // the saved menu is already on screen; this only refreshes it if it is stale
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Back in the app after a while: refresh the menu if it has gone stale (prices, stock).
  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    if (s == AppLifecycleState.resumed) _load();
  }

  Future<void> _load({bool force = false}) => ref.read(catalogProvider.notifier).load(force: force);

  @override
  Widget build(BuildContext context) {
    // whenever the menu changes, the cart follows: current prices, delivery rule, nothing that's gone
    ref.listen(catalogProvider, (prev, next) {
      if (identical(prev?.catalog, next.catalog) || next.catalog == null) return;
      final cart = ref.read(cartProvider.notifier);
      cart.setRule(next.rule);
      cart.syncWith(next.products);
    });
    return Scaffold(
      body: IndexedStack(index: _tab, children: [MenuScreen(onRetry: () => _load(force: true)), const OrdersScreen(), const AccountScreen()]),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_tab == 0) const CartBar(),
          NavigationBar(
            selectedIndex: _tab,
            height: 62,
            indicatorColor: Brand.accentTint,
            onDestinationSelected: (i) {
              setState(() => _tab = i);
              if (i == 1) ref.read(accountProvider.notifier).refresh();
            },
            destinations: const [
              NavigationDestination(icon: Icon(Icons.restaurant_menu_outlined), selectedIcon: Icon(Icons.restaurant_menu, color: Brand.accent), label: 'Order'),
              NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long, color: Brand.accent), label: 'My orders'),
              NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person, color: Brand.accent), label: 'Account'),
            ],
          ),
        ],
      ),
    );
  }
}

class MenuScreen extends ConsumerStatefulWidget {
  const MenuScreen({super.key, required this.onRetry});
  final Future<void> Function() onRetry;

  @override
  ConsumerState<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends ConsumerState<MenuScreen> {
  final _search = TextEditingController();
  String? _category;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(catalogProvider);
    final count = ref.watch(cartProvider.select((c) => c.count));

    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        color: Brand.accent,
        onRefresh: widget.onRetry,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverAppBar(
              floating: true,
              snap: true,
              toolbarHeight: 64,
              titleSpacing: 16,
              title: Row(
                children: [
                  Image.asset('assets/images/gaia-logo.jpg', height: 40, fit: BoxFit.contain),
                  const SizedBox(width: 10),
                  Flexible(child: Text(tagline, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w600))),
                ],
              ),
              actions: [
                IconButton(
                  tooltip: 'Cart',
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
                  icon: Badge(
                    isLabelVisible: count > 0,
                    label: Text('$count'),
                    backgroundColor: Brand.accent,
                    child: const Icon(Icons.shopping_bag_outlined, size: 26),
                  ),
                ),
                const SizedBox(width: 4),
              ],
            ),
            ..._body(catalog),
          ],
        ),
      ),
    );
  }

  List<Widget> _body(CatalogData catalog) {
    if (catalog.catalog == null) {
      if (catalog.loading) return [const SliverFillRemaining(hasScrollBody: false, child: Center(child: CircularProgressIndicator(color: Brand.accent)))];
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.cloud_off, size: 56, color: Brand.faint),
                  const SizedBox(height: 12),
                  Text(catalog.error ?? 'Could not load the menu.', textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: widget.onRetry, style: FilledButton.styleFrom(minimumSize: const Size(140, 46)), child: const Text('Try again')),
                ],
              ),
            ),
          ),
        ),
      ];
    }

    final term = _search.text.trim().toLowerCase();
    final searching = term.isNotEmpty;
    final shown = catalog.products.where((p) {
      if (_category != null && p.category != _category) return false;
      if (searching && !'${p.name} ${p.category} ${p.subCategory}'.toLowerCase().contains(term)) return false;
      return true;
    }).toList();

    final groups = <String, List<Product>>{};
    for (final p in shown) {
      groups.putIfAbsent(p.category, () => []).add(p);
    }

    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: TextField(
            controller: _search,
            onChanged: (_) => setState(() {}),
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: "Search for 'paneer', 'ghee', 'dahi'",
              prefixIcon: const Icon(Icons.search, color: Brand.muted),
              suffixIcon: searching ? IconButton(icon: const Icon(Icons.close), onPressed: () => setState(_search.clear)) : null,
              filled: true,
              fillColor: Brand.surface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
            ),
          ),
        ),
      ),
      if (!searching && catalog.banners.isNotEmpty)
        SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.only(top: 16), child: BannerCarousel(banners: catalog.banners))),
      if (!searching && catalog.categories.length > 1)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: Text("What's on your mind?", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
                const SizedBox(height: 12),
                SizedBox(
                  height: 114,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: catalog.categories.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 16),
                    itemBuilder: (_, i) {
                      final c = catalog.categories[i];
                      final on = _category == c.name;
                      return GestureDetector(
                        onTap: () => setState(() => _category = on ? null : c.name),
                        child: SizedBox(
                          width: 78,
                          child: Column(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(2),
                                decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: on ? Brand.accent : Colors.transparent, width: 2)),
                                child: ProductImage(url: c.image, size: 68, circle: true),
                              ),
                              const SizedBox(height: 6),
                              Text(c.name,
                                  maxLines: 2,
                                  textAlign: TextAlign.center,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 12.5, height: 1.15, fontWeight: on ? FontWeight.w800 : FontWeight.w600, color: on ? Brand.accent : Brand.ink)),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      if (groups.isEmpty)
        SliverFillRemaining(hasScrollBody: false, child: Center(child: Text('Nothing matches "${_search.text.trim()}".', style: const TextStyle(color: Brand.muted))))
      else
        for (final g in groups.entries) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 22, 16, 0),
              child: Text.rich(TextSpan(children: [
                TextSpan(text: g.key, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                TextSpan(text: '  (${g.value.length})', style: const TextStyle(fontSize: 14, color: Brand.faint, fontWeight: FontWeight.w600)),
              ])),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            sliver: SliverGrid.builder(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 18,
                crossAxisSpacing: 14,
                // square photo (ADD on its corner) + fixed room for size, 2 lines of name and the price
                mainAxisExtent: (MediaQuery.sizeOf(context).width - 46) / 2 + 112,
              ),
              itemCount: g.value.length,
              itemBuilder: (_, i) => ProductTile(
                product: g.value[i],
                onOpen: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ProductScreen(product: g.value[i]))),
              ),
            ),
          ),
        ],
      const SliverToBoxAdapter(child: SizedBox(height: 24)),
    ];
  }
}
