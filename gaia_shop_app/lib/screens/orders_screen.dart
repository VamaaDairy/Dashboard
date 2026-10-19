import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../store/account.dart';
import '../theme.dart';
import 'order_screen.dart';

/// "My orders": everything this phone has ordered, newest first.
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(accountProvider);

    Widget body;
    if (s.loading && s.orders.isEmpty) {
      body = const Center(child: CircularProgressIndicator(color: Brand.accent));
    } else if (s.orders.isEmpty) {
      body = ListView(children: [
        const SizedBox(height: 120),
        Center(child: Text(s.error ?? (s.hasOrders ? 'Pull down to load your orders.' : 'No orders yet.\nYour orders will show up here.'), textAlign: TextAlign.center, style: const TextStyle(color: Brand.muted))),
      ]);
    } else {
      body = ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: s.orders.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (_, i) {
          final o = s.orders[i];
          final live = o.status != 'delivered' && o.status != 'cancelled';
          return InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => OrderScreen(order: o))),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(16)),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(o.orderNo, style: const TextStyle(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 2),
                        Text(o.items.map((e) => '${e.name} × ${e.qty}').join(', '), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Brand.muted, fontSize: 13)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(rupees(o.total), style: const TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text(o.statusLabel, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: o.status == 'cancelled' ? Brand.danger : live ? const Color(0xFFB36B00) : Brand.veg)),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      );
    }

    return SafeArea(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(padding: EdgeInsets.fromLTRB(16, 16, 16, 4), child: Text('My orders', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800))),
          Expanded(child: RefreshIndicator(color: Brand.accent, onRefresh: ref.read(accountProvider.notifier).refresh, child: body)),
        ],
      ),
    );
  }
}
