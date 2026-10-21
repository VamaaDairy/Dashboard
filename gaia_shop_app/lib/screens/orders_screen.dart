import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models.dart';
import '../store/account.dart';
import '../theme.dart';
import '../ui.dart';
import '../widgets.dart';
import 'order_screen.dart';

/// Colour and icon of an order status, used on the list and the order page.
(Color, IconData) statusLook(String status) => switch (status) {
      'delivered' => (Brand.veg, Icons.check_circle_rounded),
      'cancelled' => (Brand.danger, Icons.cancel_rounded),
      'out_for_delivery' => (Brand.sky, Icons.two_wheeler_rounded),
      'confirmed' => (Brand.accent, Icons.inventory_2_outlined),
      _ => (Brand.warn, Icons.schedule_rounded),
    };

String orderDate(DateTime d) {
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  return '${d.day} ${m[d.month - 1]} · $h:${d.minute.toString().padLeft(2, '0')} ${d.hour >= 12 ? 'PM' : 'AM'}';
}

/// "Orders": everything this account has ordered, newest first, filterable by ongoing / past.
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  int _filter = 0; // all, ongoing, past

  @override
  void initState() {
    super.initState();
    // opened straight (not via the tab), it fetches its own orders
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && ref.read(accountProvider).orders.isEmpty) ref.read(accountProvider.notifier).refresh();
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(accountProvider);
    final orders = s.orders.where((o) => _filter == 0 || (_filter == 1 ? o.isOpen : !o.isOpen)).toList();

    Widget body;
    if (s.loading && s.orders.isEmpty) {
      body = ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: 3,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (_, __) => const Skeleton(height: 150, radius: 18),
      );
    } else if (orders.isEmpty) {
      body = ListView(children: [
        const SizedBox(height: 70),
        EmptyState(
          icon: Icons.receipt_long_outlined,
          title: s.orders.isEmpty ? 'No orders yet' : (_filter == 1 ? 'Nothing on its way' : 'No past orders'),
          message: s.error ?? (s.orders.isEmpty ? 'When you order, you can track it here - live, all the way to your door.' : 'Pull down to refresh.'),
        ),
      ]);
    } else {
      body = ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        itemCount: orders.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (_, i) => _OrderCard(order: orders[i]),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Orders'), automaticallyImplyLeading: false),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
          child: Row(children: [
            for (final (i, label) in const ['All', 'Ongoing', 'Past'].indexed)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(label),
                  selected: _filter == i,
                  showCheckmark: false,
                  labelStyle: TextStyle(fontWeight: FontWeight.w700, color: _filter == i ? Colors.white : Brand.ink),
                  onSelected: (_) => setState(() => _filter = i),
                ),
              ),
          ]),
        ),
        Expanded(child: RefreshIndicator(color: Brand.accent, onRefresh: ref.read(accountProvider.notifier).refresh, child: body)),
      ]),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});
  final Order order;

  @override
  Widget build(BuildContext context) {
    final o = order;
    void open() => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => OrderScreen(order: o)));
    final pics = o.items.take(3).toList();

    return AppCard(
      onTap: open,
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          // just the word: no colour, no icon, no badge
          Text(o.statusLabel, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Brand.ink)),
          const Spacer(),
          Text(orderDate(o.createdAt), style: const TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w600)),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          for (final (i, it) in pics.indexed)
            Container(
              margin: EdgeInsets.only(right: i == pics.length - 1 ? 0 : 6),
              width: 48,
              height: 48,
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(12)),
              child: ProductImage(url: it.image, radius: 0, fit: BoxFit.contain),
            ),
          if (o.items.length > 3)
            Container(
              margin: const EdgeInsets.only(left: 6),
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: Brand.accentTint, borderRadius: BorderRadius.circular(12)),
              child: Text('+${o.items.length - 3}', style: const TextStyle(fontWeight: FontWeight.w800, color: Brand.accent)),
            ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(o.items.map((e) => '${e.name} × ${e.qty}').join(', '),
                maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: Brand.muted, height: 1.35)),
          ),
        ]),
        const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider()),
        Row(children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(rupees(o.total), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
            Text(o.orderNo, style: const TextStyle(fontSize: 12, color: Brand.faint, fontWeight: FontWeight.w600)),
          ]),
          const Spacer(),
          if (o.isOpen)
            FilledButton.icon(
              onPressed: open,
              style: FilledButton.styleFrom(minimumSize: const Size(0, 42), padding: const EdgeInsets.symmetric(horizontal: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              icon: const Icon(Icons.near_me_rounded, size: 18),
              label: const Text('Track order', style: TextStyle(fontSize: 14)),
            )
          else
            TextButton(onPressed: open, child: const Row(mainAxisSize: MainAxisSize.min, children: [Text('Details'), Icon(Icons.chevron_right_rounded, size: 18)])),
        ]),
      ]),
    );
  }
}
