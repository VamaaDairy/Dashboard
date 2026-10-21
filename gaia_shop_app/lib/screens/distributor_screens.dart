import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config.dart';
import '../models.dart';
import '../store/distributor.dart';
import '../theme.dart';
import '../ui.dart';
import 'orders_screen.dart' show orderDate;

/// The signed-in distributor's / sales officer's side of the normal app: which distributor the order
/// is for, the primary orders already placed, and the account page. The menu, product pages and cart
/// are the everyday ones, at dealer prices.

/// Shown instead of the menu until a sales officer has chosen the distributor to order for.
class DistFirmPicker extends ConsumerStatefulWidget {
  const DistFirmPicker({super.key});

  @override
  ConsumerState<DistFirmPicker> createState() => _DistFirmPickerState();
}

class _DistFirmPickerState extends ConsumerState<DistFirmPicker> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final d = ref.watch(distributorProvider);
    final store = ref.read(distributorProvider.notifier);
    if (d.loading) return const Center(child: CircularProgressIndicator());
    if (d.firms.isEmpty) {
      return Center(
        child: EmptyState(
          icon: Icons.storefront_outlined,
          title: 'No distributor linked',
          message: d.error ?? 'No distributor is linked to this login yet. Please contact Gaia.',
          action: 'Try again',
          onAction: store.start,
        ),
      );
    }
    final q = _q.trim().toLowerCase();
    final firms = q.isEmpty ? d.firms : d.firms.where((f) => '${f.name} ${f.code} ${f.city ?? ''}'.toLowerCase().contains(q)).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        const Text('Order for which distributor?', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        if (d.firms.length > 8)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: TextField(
              onChanged: (v) => setState(() => _q = v),
              decoration: const InputDecoration(hintText: 'Search name, code or city', prefixIcon: Icon(Icons.search_rounded)),
            ),
          ),
        for (final f in firms)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: AppCard(
              onTap: () => store.selectFirm(f),
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(f.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    const SizedBox(height: 2),
                    Text([f.code, if (f.city != null) f.city!].join(' · '), style: const TextStyle(color: Brand.muted, fontSize: 13)),
                  ]),
                ),
                const Icon(Icons.chevron_right_rounded, color: Brand.faint),
              ]),
            ),
          ),
      ],
    );
  }
}

/// "Ordering for X - Change" strip under the menu's header.
class DistFirmBar extends ConsumerWidget {
  const DistFirmBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(distributorProvider);
    if (d.firm == null) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.fromLTRB(14, 8, 6, 8),
      decoration: BoxDecoration(color: Brand.accentTint, borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        const Icon(Icons.storefront_outlined, size: 18, color: Brand.accent),
        const SizedBox(width: 8),
        Expanded(child: Text('Ordering for ${d.firm!.name}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5))),
        if (d.firms.length > 1) TextButton(onPressed: () => ref.read(distributorProvider.notifier).selectFirm(null), child: const Text('Change')),
      ]),
    );
  }
}

/// Orders tab: the primary orders this login placed, newest first; tap one for its lines.
class DistOrdersScreen extends ConsumerWidget {
  const DistOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(distributorProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Orders'), automaticallyImplyLeading: false),
      body: RefreshIndicator(
        color: Brand.accent,
        onRefresh: ref.read(distributorProvider.notifier).loadOrders,
        child: d.orders.isEmpty
            ? ListView(children: const [
                SizedBox(height: 70),
                EmptyState(icon: Icons.receipt_long_outlined, title: 'No orders yet', message: 'Orders you place show up here. Pull down to refresh.'),
              ])
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                itemCount: d.orders.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (_, i) => _DistOrderCard(order: d.orders[i]),
              ),
      ),
    );
  }
}

class _DistOrderCard extends StatelessWidget {
  const _DistOrderCard({required this.order});
  final DistOrder order;

  @override
  Widget build(BuildContext context) {
    final o = order;
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: EdgeInsets.zero,
          childrenPadding: EdgeInsets.zero,
          title: Row(children: [
            Text(o.status, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
            const Spacer(),
            Text(orderDate(o.date), style: const TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w600)),
          ]),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(children: [
              Expanded(child: Text('#${o.orderId} · ${o.distributor}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Brand.muted, fontSize: 13))),
              Text(rupees(o.total), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Brand.ink)),
            ]),
          ),
          children: [
            const Divider(),
            for (final l in o.lines)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(children: [
                  Expanded(
                    child: Text('${l.name} × ${l.qty.toStringAsFixed(l.qty == l.qty.roundToDouble() ? 0 : 2)}', style: const TextStyle(fontSize: 13.5)),
                  ),
                  Text(rupees(l.amount), style: const TextStyle(fontWeight: FontWeight.w700)),
                ]),
              ),
          ],
        ),
      ),
    );
  }
}

/// Account tab for a distributor / sales officer: who they are, their orders, sign out. No delivery
/// address, subscriptions or partner logins.
class PartnerAccountScreen extends ConsumerWidget {
  const PartnerAccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(distributorProvider);
    final p = d.profile;
    if (p == null) return const SizedBox.shrink();
    final initials = p.name.trim().isEmpty ? '?' : p.name.trim().split(RegExp(r'\s+')).take(2).map((w) => w[0].toUpperCase()).join();
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        automaticallyImplyLeading: false,
        titleSpacing: 20,
        title: const Text('Account', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: -0.3, height: 1.2)),
                  const SizedBox(height: 4),
                  Text('+91 ${p.phone}', style: const TextStyle(fontSize: 14.5, color: Brand.muted, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 4),
                  Text(p.isSalesman ? 'Sales officer' : 'Distributor', style: const TextStyle(fontSize: 13.5, color: Brand.accent, fontWeight: FontWeight.w700)),
                ]),
              ),
              const SizedBox(width: 16),
              CircleAvatar(radius: 34, backgroundColor: Brand.accentTint, child: Text(initials, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Brand.accent))),
            ]),
          ),
          Container(height: 8, color: Brand.surface),
          if (d.firm != null && d.firms.length > 1)
            ListTile(
              leading: const Icon(Icons.storefront_outlined, color: Brand.ink),
              title: const Text('Ordering for', style: TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(d.firm!.name),
              trailing: const Icon(Icons.chevron_right_rounded, color: Brand.faint),
              onTap: () => ref.read(distributorProvider.notifier).selectFirm(null),
            ),
          ListTile(
            leading: const Icon(Icons.description_outlined, color: Brand.ink),
            title: const Text('Licences', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: const Text('Open-source software in this app'),
            onTap: () => showLicensePage(context: context, applicationName: appName),
          ),
          ListTile(
            leading: const Icon(Icons.logout_rounded, color: Brand.danger),
            title: const Text('Sign out', style: TextStyle(fontWeight: FontWeight.w700, color: Brand.danger)),
            onTap: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (c) => AlertDialog(
                  title: const Text('Sign out?'),
                  content: const Text('Your orders stay with your account. Sign in again any time.'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
                    TextButton(onPressed: () => Navigator.pop(c, true), style: TextButton.styleFrom(foregroundColor: Brand.danger), child: const Text('Sign out')),
                  ],
                ),
              );
              if (ok == true) await ref.read(distributorProvider.notifier).logout();
            },
          ),
        ],
      ),
    );
  }
}
