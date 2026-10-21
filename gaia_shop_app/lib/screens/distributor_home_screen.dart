import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models.dart';
import '../store/distributor.dart';
import '../theme.dart';
import '../widgets.dart';

String _rs(double v) => '₹${v.toStringAsFixed(v == v.roundToDouble() ? 0 : 2)}';

/// A distributor's (or salesman's) home: build a primary order from the catalogue at dealer
/// price, and see the orders already placed. A salesman first picks the distributor.
class DistributorHomeScreen extends ConsumerStatefulWidget {
  const DistributorHomeScreen({super.key});

  @override
  ConsumerState<DistributorHomeScreen> createState() => _DistributorHomeScreenState();
}

class _DistributorHomeScreenState extends ConsumerState<DistributorHomeScreen> {
  @override
  void initState() {
    super.initState();
    // after the first frame: right after sign-in this is built inside the rebuild login() triggered
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final s = ref.read(distributorProvider.notifier);
      s.start();
      s.loadOrders();
    });
  }

  @override
  Widget build(BuildContext context) {
    final d = ref.watch(distributorProvider);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(d.profile == null ? 'Gaia' : '${d.profile!.name}${d.profile!.kind == 'salesman' ? ' · Sales officer' : ''}', overflow: TextOverflow.ellipsis),
          actions: [
            IconButton(
              tooltip: 'Sign out',
              icon: const Icon(Icons.logout),
              onPressed: () => ref.read(distributorProvider.notifier).logout(),
            ),
          ],
          bottom: const TabBar(tabs: [Tab(text: 'New order'), Tab(text: 'My orders')]),
        ),
        body: const TabBarView(children: [_NewOrder(), _MyOrders()]),
      ),
    );
  }
}

class _NewOrder extends ConsumerStatefulWidget {
  const _NewOrder();

  @override
  ConsumerState<_NewOrder> createState() => _NewOrderState();
}

class _NewOrderState extends ConsumerState<_NewOrder> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final d = ref.watch(distributorProvider);
    final store = ref.read(distributorProvider.notifier);
    final q = _q.trim().toLowerCase();

    if (d.firm == null) {
      if (d.loading) return const Center(child: CircularProgressIndicator());
      if (d.firms.isEmpty) {
        return _Message(d.error ?? 'No distributor is linked to this login yet. Please contact Gaia.', onRetry: store.start);
      }
      final firms = q.isEmpty ? d.firms : d.firms.where((f) => '${f.name} ${f.code} ${f.city ?? ''}'.toLowerCase().contains(q)).toList();
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Order for which distributor?', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          if (d.firms.length > 8)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TextField(
                onChanged: (v) => setState(() => _q = v),
                decoration: const InputDecoration(hintText: 'Search name, code or city', prefixIcon: Icon(Icons.search)),
              ),
            ),
          for (final f in firms)
            Card(
              child: ListTile(
                title: Text(f.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text([f.code, if (f.city != null) f.city!].join(' · ')),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  setState(() => _q = '');
                  store.selectFirm(f);
                },
              ),
            ),
        ],
      );
    }

    final products = q.isEmpty ? d.products : d.products.where((p) => '${p.name} ${p.category} ${p.size ?? ''}'.toLowerCase().contains(q)).toList();
    return Column(
      children: [
        Container(
          width: double.infinity,
          color: Brand.accentTint,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Expanded(child: Text('For ${d.firm!.name}', style: const TextStyle(fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis)),
              if (d.firms.length > 1)
                TextButton(
                  onPressed: () {
                    setState(() => _q = '');
                    store.selectFirm(null);
                  },
                  child: const Text('Change'),
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
          child: TextField(
            onChanged: (v) => setState(() => _q = v),
            decoration: const InputDecoration(hintText: 'Search products', prefixIcon: Icon(Icons.search)),
          ),
        ),
        if (d.error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Text(d.error!, style: const TextStyle(color: Color(0xFFB3202D), fontWeight: FontWeight.w600)),
          ),
        Expanded(
          child: d.loading && d.products.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : d.products.isEmpty
                  ? _Message('No products are available to order.', onRetry: () => store.selectFirm(d.firm))
                  : LayoutBuilder(builder: (_, c) {
                      final tileW = (c.maxWidth - 32 - 12) / 2;
                      return GridView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          mainAxisExtent: (tileW - 12) / 1.08 + 128,
                        ),
                        itemCount: products.length,
                        itemBuilder: (_, i) => _ProductTile(product: products[i], qty: d.qty[products[i].sku] ?? 0),
                      );
                    }),
        ),
        if (d.qty.isNotEmpty) _OrderBar(d: d),
      ],
    );
  }
}

/// The retail menu's product tile, minus Subscribe (a primary order is a one-off): photo, size, name,
/// dealer price with the MRP, and ADD / the quantity stepper on the photo's corner.
class _ProductTile extends ConsumerWidget {
  const _ProductTile({required this.product, required this.qty});
  final Product product;
  final int qty;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = product;
    final store = ref.read(distributorProvider.notifier);
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: Brand.line)),
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
                      decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(14)),
                      padding: const EdgeInsets.fromLTRB(10, 10, 10, 18),
                      child: ProductImage(url: p.image, radius: 0, fit: BoxFit.contain),
                    ),
                  ),
                  Positioned(right: 6, bottom: -14, child: _Stepper(qty: qty, store: store, product: p)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 20, 6, 0),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(
                  height: 18,
                  child: (p.size != null && p.size!.isNotEmpty)
                      ? Text(p.size!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, color: Brand.muted, fontWeight: FontWeight.w600))
                      : null,
                ),
                SizedBox(
                  height: 36,
                  child: Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, height: 1.3, color: Brand.ink)),
                ),
                const SizedBox(height: 6),
                Row(children: [
                  Text(_rs(p.price), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Brand.ink)),
                  const SizedBox(width: 6),
                  if (p.mrp > p.price) Text(_rs(p.mrp), style: const TextStyle(fontSize: 12, color: Brand.faint, decoration: TextDecoration.lineThrough)),
                ]),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

/// ADD, which becomes a  -  qty  +  stepper; tap the number to type it (distributors order in cases).
class _Stepper extends StatelessWidget {
  const _Stepper({required this.qty, required this.store, required this.product});
  final int qty;
  final DistributorStore store;
  final Product product;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(9);
    if (qty == 0) {
      return Material(
        color: Colors.white,
        borderRadius: r,
        elevation: 2,
        shadowColor: Colors.black26,
        child: InkWell(
          onTap: () {
            HapticFeedback.lightImpact();
            store.setQty(product.sku, 1);
          },
          borderRadius: r,
          child: Container(
            width: 76,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(borderRadius: r, border: Border.all(color: Brand.accent, width: 1.2)),
            child: const Text('ADD', style: TextStyle(color: Brand.accent, fontWeight: FontWeight.w800, fontSize: 14, letterSpacing: 0.6)),
          ),
        ),
      );
    }
    Widget step(IconData icon, int to) => InkWell(
          onTap: () => store.setQty(product.sku, to),
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(width: 26, height: double.infinity, child: Icon(icon, color: Colors.white, size: 16)),
        );
    return Container(
      width: 88,
      height: 34,
      decoration: BoxDecoration(
        color: Brand.accent,
        borderRadius: r,
        boxShadow: const [BoxShadow(color: Color(0x2E000000), blurRadius: 8, offset: Offset(0, 2))],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          step(Icons.remove, qty - 1),
          Expanded(
            child: InkWell(
              onTap: () async {
                final n = await _askQty(context, product.name, qty);
                if (n != null) store.setQty(product.sku, n);
              },
              child: Center(child: Text('$qty', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15))),
            ),
          ),
          step(Icons.add, qty + 1),
        ],
      ),
    );
  }
}

/// Distributors order in cases/dozens: tap the number to type it instead of tapping + many times.
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

/// The bar at the bottom once something is in the order, like the retail cart bar - without any delivery charge.
class _OrderBar extends StatelessWidget {
  const _OrderBar({required this.d});
  final DistData d;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        child: Material(
          color: Brand.accent,
          borderRadius: BorderRadius.circular(16),
          elevation: 6,
          shadowColor: Brand.accent.withValues(alpha: 0.5),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const _ReviewOrderScreen())),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${d.lines} ${d.lines == 1 ? 'ITEM' : 'ITEMS'} · ${d.units} QTY',
                            style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
                        Text(_rs(d.total), style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                  const Text('Review order', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                  const Icon(Icons.chevron_right, color: Colors.white),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The order's lines with a bill total and Place order - the retail cart/checkout, for a primary order.
class _ReviewOrderScreen extends ConsumerStatefulWidget {
  const _ReviewOrderScreen();

  @override
  ConsumerState<_ReviewOrderScreen> createState() => _ReviewOrderScreenState();
}

class _ReviewOrderScreenState extends ConsumerState<_ReviewOrderScreen> {
  final _notes = TextEditingController();

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _place() async {
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final id = await ref.read(distributorProvider.notifier).place(notes: _notes.text);
    if (id == null) return;
    messenger.showSnackBar(SnackBar(content: Text('Order #$id placed')));
    nav.pop();
  }

  @override
  Widget build(BuildContext context) {
    final d = ref.watch(distributorProvider);
    final store = ref.read(distributorProvider.notifier);
    final lines = d.products.where((p) => (d.qty[p.sku] ?? 0) > 0).toList();
    // the last line was removed: nothing left to review
    if (lines.isEmpty && !d.placing) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.of(context).maybePop();
      });
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Your order')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('For ${d.firm?.name ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700, color: Brand.muted)),
          const SizedBox(height: 8),
          for (final p in lines)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  ProductImage(url: p.image, size: 52, radius: 10),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                        Text('${_rs(p.price)} × ${d.qty[p.sku]} = ${_rs(p.price * d.qty[p.sku]!)}', style: const TextStyle(color: Brand.muted, fontSize: 12.5)),
                      ],
                    ),
                  ),
                  _Stepper(qty: d.qty[p.sku] ?? 0, store: store, product: p),
                ],
              ),
            ),
          const Divider(height: 28, color: Brand.line),
          TextField(controller: _notes, maxLength: 300, decoration: const InputDecoration(labelText: 'Note for Gaia (optional)')),
          const SizedBox(height: 8),
          Row(
            children: [
              const Text('Bill total', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              const Spacer(),
              Text(_rs(d.total), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            ],
          ),
          if (d.error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(d.error!, style: const TextStyle(color: Color(0xFFB3202D), fontWeight: FontWeight.w600)),
            ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: FilledButton(
            onPressed: d.placing || d.qty.isEmpty ? null : _place,
            child: d.placing ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : Text('Place order · ${_rs(d.total)}'),
          ),
        ),
      ),
    );
  }
}

class _MyOrders extends ConsumerWidget {
  const _MyOrders();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(distributorProvider);
    return RefreshIndicator(
      onRefresh: ref.read(distributorProvider.notifier).loadOrders,
      child: d.orders.isEmpty
          ? ListView(children: const [SizedBox(height: 120), Center(child: Text('No orders yet.', style: TextStyle(color: Brand.muted)))])
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: d.orders.length,
              itemBuilder: (_, i) {
                final o = d.orders[i];
                final date = '${o.date.day.toString().padLeft(2, '0')}/${o.date.month.toString().padLeft(2, '0')}/${o.date.year}';
                return Card(
                  child: ExpansionTile(
                    title: Text('#${o.orderId} · ${o.distributor}', style: const TextStyle(fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis),
                    subtitle: Text('$date · ${o.status} · ${_rs(o.total)}'),
                    children: [
                      for (final l in o.lines)
                        ListTile(
                          dense: true,
                          title: Text(l.name),
                          subtitle: Text('${l.qty.toStringAsFixed(l.qty == l.qty.roundToDouble() ? 0 : 2)} × ${_rs(l.rate)}'),
                          trailing: Text(_rs(l.amount), style: const TextStyle(fontWeight: FontWeight.w700)),
                        ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message(this.text, {required this.onRetry});
  final String text;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(text, textAlign: TextAlign.center, style: const TextStyle(color: Brand.muted)),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
            ],
          ),
        ),
      );
}
