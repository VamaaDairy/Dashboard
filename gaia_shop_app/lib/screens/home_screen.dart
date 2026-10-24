import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../banner_carousel.dart';
import '../models.dart';
import '../store/account.dart';
import '../store/cart.dart';
import '../store/catalog.dart';
import '../store/distributor.dart';
import '../theme.dart';
import '../ui.dart';
import '../widgets.dart';
import 'account_screen.dart';
import 'cart_screen.dart';
import 'distributor_screens.dart';
import 'my_calendar_screen.dart';
import 'orders_screen.dart';
import 'product_screen.dart';

/// The app's frame: Home, Calendar, Orders and Account, with the cart bar floating above the tabs on Home.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> with WidgetsBindingObserver {
  int _tab = 0;
  Timer? _poll;
  bool _inForeground = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // a distributor looking at the Orders tab sees the office confirm / cancel an order within seconds
    _poll = Timer.periodic(const Duration(seconds: 8), (_) {
      if (_inForeground && _tab == 1 && ref.read(distributorProvider).signedIn) ref.read(distributorProvider.notifier).loadOrders();
    });
    // the saved menu is already on screen; this only refreshes it if it is stale
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _load();
      _startPartner();
    });
  }

  /// A signed-in distributor / sales officer: load who they can order for (and their past orders).
  void _startPartner() {
    if (!mounted || !ref.read(distributorProvider).signedIn) return;
    final s = ref.read(distributorProvider.notifier);
    s.start();
    s.loadOrders();
  }

  @override
  void dispose() {
    _poll?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Back in the app: refresh the menu if it has gone stale (prices, stock); a distributor gets
  /// today's dealer prices, quietly - the menu only changes if a price did.
  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    _inForeground = s == AppLifecycleState.resumed;
    if (s != AppLifecycleState.resumed) return;
    if (ref.read(distributorProvider).signedIn) {
      ref.read(distributorProvider.notifier).refreshPrices();
      ref.read(distributorProvider.notifier).loadOrders();
    } else {
      _load();
    }
  }

  Future<void> _load({bool force = false}) => ref.read(catalogProvider.notifier).load(force: force);

  /// Pull to refresh / Try again on a distributor's menu: today's dealer prices.
  Future<void> _reloadPrices() {
    final d = ref.read(distributorProvider), s = ref.read(distributorProvider.notifier);
    if (d.firm != null && d.products.isEmpty) return s.selectFirm(d.firm);
    return s.refreshPrices(minGap: Duration.zero);
  }

  @override
  Widget build(BuildContext context) {
    // whenever the menu changes, the cart follows: current prices, delivery rule, nothing that's gone
    ref.listen(distributorProvider.select((d) => d.signedIn), (prev, next) {
      if (next) _startPartner();
      setState(() => _tab = 0);
    });
    final partner = ref.watch(distributorProvider.select((d) => d.signedIn));
    ref.listen(menuProvider, (prev, next) {
      if (identical(prev?.catalog, next.catalog) || next.catalog == null) return;
      final cart = ref.read(cartProvider.notifier);
      cart.setRule(next.rule);
      cart.syncWith(next.products);
    });
    return Scaffold(
      // distributors / sales officers get no Calendar (subscriptions are for home delivery)
      body: IndexedStack(index: _tab, children: [
        MenuScreen(onRetry: () => partner ? _reloadPrices() : _load(force: true)),
        if (!partner) const MyCalendarScreen(),
        partner ? const DistOrdersScreen() : const OrdersScreen(),
        partner ? const PartnerAccountScreen() : const AccountScreen(),
      ]),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_tab == 0) const CartBar(),
          DecoratedBox(
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: Brand.line))),
            child: NavigationBar(
              selectedIndex: _tab,
              onDestinationSelected: (i) {
                setState(() => _tab = i);
                if (i == (partner ? 1 : 2)) {
                  partner ? ref.read(distributorProvider.notifier).loadOrders() : ref.read(accountProvider.notifier).refresh();
                }
              },
              destinations: [
                const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
                if (!partner) const NavigationDestination(icon: Icon(Icons.calendar_month_outlined), selectedIcon: Icon(Icons.calendar_month), label: 'Calendar'),
                const NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Orders'),
                const NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Account'),
              ],
            ),
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

  String get _greeting {
    final h = DateTime.now().hour;
    return h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening');
  }

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(menuProvider);
    final dist = ref.watch(distributorProvider);
    final count = ref.watch(cartProvider.select((c) => c.count));
    final name = dist.signedIn
        ? dist.profile!.name.split(' ').first
        : ref.watch(accountProvider.select((a) => a.signedIn ? a.customer.name.split(' ').first : ''));

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
              toolbarHeight: 72,
              titleSpacing: 16,
              title: Row(children: [
                Image.asset('assets/images/gaia-logo.jpg', height: 42, fit: BoxFit.contain),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(name.isEmpty ? _greeting : '$_greeting, $name', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                    Text(dist.signedIn ? dist.profile!.label : 'Fresh dairy, delivered every morning', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w500)),
                  ]),
                ),
              ]),
              actions: [
                Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: Material(
                    color: Brand.surface,
                    shape: const CircleBorder(),
                    child: IconButton(
                      tooltip: 'Cart',
                      onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
                      icon: Badge(
                        isLabelVisible: count > 0,
                        label: Text('$count'),
                        backgroundColor: Brand.gaiaGreen,
                        child: const Icon(Icons.shopping_bag_outlined, size: 24),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (dist.signedIn && dist.firm == null)
              const SliverFillRemaining(hasScrollBody: false, child: DistFirmPicker())
            else ...[
              if (dist.signedIn) const SliverToBoxAdapter(child: DistFirmBar()),
              ..._body(catalog),
            ],
          ],
        ),
      ),
    );
  }

  /// While the very first menu loads: the page's shape in soft shimmer.
  List<Widget> _skeleton() {
    final w = (MediaQuery.sizeOf(context).width - 46) / 2;
    return [
      const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.fromLTRB(16, 4, 16, 0), child: Skeleton(height: 54, radius: 16))),
      const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.fromLTRB(16, 16, 16, 0), child: Skeleton(height: 190, radius: 22))),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
          child: Row(children: [for (var i = 0; i < 4; i++) const Expanded(child: Padding(padding: EdgeInsets.symmetric(horizontal: 5), child: Skeleton(height: 84, radius: 18)))]),
        ),
      ),
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
        sliver: SliverGrid.count(
          crossAxisCount: 2,
          mainAxisSpacing: 18,
          crossAxisSpacing: 14,
          childAspectRatio: w / (w + 96),
          children: [
            for (var i = 0; i < 4; i++)
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                AspectRatio(aspectRatio: 1, child: Skeleton(height: w, radius: 16)),
                const SizedBox(height: 12),
                Skeleton(width: w * 0.8),
                const SizedBox(height: 8),
                Skeleton(width: w * 0.4),
              ]),
          ],
        ),
      ),
    ];
  }

  List<Widget> _body(CatalogData catalog) {
    if (catalog.catalog == null) {
      if (catalog.loading || catalog.error == null) return _skeleton();
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: EmptyState(icon: Icons.wifi_off_rounded, title: 'No connection', message: catalog.error, action: 'Try again', onAction: widget.onRetry),
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
    final tileW = (MediaQuery.sizeOf(context).width - 46) / 2;

    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: TextField(
            controller: _search,
            onChanged: (_) => setState(() {}),
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: "Search milk, paneer, ghee, dahi…",
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: searching ? IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => setState(_search.clear)) : null,
            ),
          ),
        ),
      ),
      if (!searching && catalog.banners.isNotEmpty)
        SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.only(top: 16), child: BannerCarousel(banners: catalog.banners))),
      // subscriptions: the fortnight at a glance
      if (!searching && !ref.read(distributorProvider).signedIn) const SliverToBoxAdapter(child: QuickCalendar()),
      if (!searching && catalog.categories.length > 1) ...[
        const SliverToBoxAdapter(child: SectionHeader('Shop By Category')),
        SliverToBoxAdapter(
          child: SizedBox(
            height: 118,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: catalog.categories.length + 1,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, i) {
                final c = i == 0 ? null : catalog.categories[i - 1];
                final on = _category == c?.name;
                return _CategoryCard(
                  label: c?.name ?? 'All',
                  image: c?.image,
                  selected: on,
                  onTap: () => setState(() => _category = (c == null || on) ? null : c.name),
                );
              },
            ),
          ),
        ),
      ],
      if (groups.isEmpty)
        SliverFillRemaining(
          hasScrollBody: false,
          child: EmptyState(icon: Icons.search_off_rounded, title: 'Nothing found', message: 'No product matches "${_search.text.trim()}". Try milk, paneer or ghee.'),
        )
      else
        for (final g in groups.entries) ...[
          SliverToBoxAdapter(child: SectionHeader(g.key, subtitle: '${g.value.length} ${g.value.length == 1 ? 'item' : 'items'}', padding: const EdgeInsets.fromLTRB(16, 26, 16, 12))),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverGrid.builder(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 20,
                crossAxisSpacing: 14,
                // square photo (ADD on its corner) + fixed room for size, 2 lines of name, the price and Subscribe
                mainAxisExtent: ProductTile.heightFor(tileW),
              ),
              itemCount: g.value.length,
              itemBuilder: (_, i) => ProductTile(
                product: g.value[i],
                onOpen: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ProductScreen(product: g.value[i]))),
              ),
            ),
          ),
        ],
      const SliverToBoxAdapter(child: SizedBox(height: 28)),
    ];
  }
}

/// A category as before: a round photo with a ring when chosen, its name below.
class _CategoryCard extends StatelessWidget {
  const _CategoryCard({required this.label, required this.image, required this.selected, required this.onTap});
  final String label;
  final String? image;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: SizedBox(
          width: 78,
          child: Column(children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.all(2.5),
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: selected ? Brand.accent : Colors.transparent, width: 2)),
              child: image == null && label == 'All'
                  ? Container(
                      width: 68,
                      height: 68,
                      decoration: const BoxDecoration(color: Brand.accentTint, shape: BoxShape.circle),
                      child: const Icon(Icons.grid_view_rounded, color: Brand.accent, size: 28),
                    )
                  : ProductImage(url: image, size: 68, circle: true),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12.5, height: 1.15, fontWeight: selected ? FontWeight.w800 : FontWeight.w600, color: selected ? Brand.accent : Brand.ink),
            ),
          ]),
        ),
      );
}
