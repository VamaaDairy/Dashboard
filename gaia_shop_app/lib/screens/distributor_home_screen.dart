import 'package:flutter/material.dart';
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
          title: Text(d.profile?.name ?? 'Gaia', overflow: TextOverflow.ellipsis),
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

class _NewOrder extends ConsumerWidget {
  const _NewOrder();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(distributorProvider);
    final store = ref.read(distributorProvider.notifier);

    if (d.firm == null) {
      if (d.loading) return const Center(child: CircularProgressIndicator());
      if (d.firms.isEmpty) {
        return _Message(d.error ?? 'No distributor is linked to this login yet. Please contact Gaia.', onRetry: store.start);
      }
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Order for which distributor?', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          for (final f in d.firms)
            Card(
              child: ListTile(
                title: Text(f.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text([f.code, if (f.city != null) f.city!].join(' · ')),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => store.selectFirm(f),
              ),
            ),
        ],
      );
    }

    return Column(
      children: [
        Container(
          width: double.infinity,
          color: Brand.accentTint,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Expanded(child: Text('For ${d.firm!.name}', style: const TextStyle(fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis)),
              if (d.firms.length > 1) TextButton(onPressed: () => store.selectFirm(null), child: const Text('Change')),
            ],
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
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                      itemCount: d.products.length,
                      separatorBuilder: (_, __) => const Divider(height: 1, color: Brand.line),
                      itemBuilder: (_, i) => _ProductRow(product: d.products[i], qty: d.qty[d.products[i].sku] ?? 0),
                    ),
        ),
        if (d.qty.isNotEmpty) _OrderBar(d: d),
      ],
    );
  }
}

class _ProductRow extends ConsumerWidget {
  const _ProductRow({required this.product, required this.qty});
  final Product product;
  final int qty;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final store = ref.read(distributorProvider.notifier);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          ProductImage(url: product.image, size: 56, radius: 10),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(product.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text('${_rs(product.price)}  ·  MRP ${_rs(product.mrp)}', style: const TextStyle(color: Brand.muted, fontSize: 12.5)),
              ],
            ),
          ),
          qty == 0
              ? OutlinedButton(onPressed: () => store.setQty(product.sku, 1), child: const Text('ADD'))
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(onPressed: () => store.setQty(product.sku, qty - 1), icon: const Icon(Icons.remove_circle_outline)),
                    InkWell(
                      onTap: () async {
                        final n = await _askQty(context, product.name, qty);
                        if (n != null) store.setQty(product.sku, n);
                      },
                      child: Padding(padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8), child: Text('$qty', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
                    ),
                    IconButton(onPressed: () => store.setQty(product.sku, qty + 1), icon: const Icon(Icons.add_circle_outline)),
                  ],
                ),
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

class _OrderBar extends ConsumerWidget {
  const _OrderBar({required this.d});
  final DistData d;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Brand.line))),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('${d.lines} items · ${d.units} qty', style: const TextStyle(color: Brand.muted, fontSize: 12.5)),
                  Text(_rs(d.total), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
            FilledButton(
              onPressed: d.placing ? null : () => _confirm(context, ref),
              child: d.placing ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Text('Place order'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirm(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Place this order?'),
        content: Text('${d.lines} items · ${d.units} qty · ${_rs(d.total)}\nfor ${d.firm!.name}'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Place order')),
        ],
      ),
    );
    if (ok != true) return;
    final id = await ref.read(distributorProvider.notifier).place();
    if (id != null) messenger.showSnackBar(SnackBar(content: Text('Order #$id placed')));
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
