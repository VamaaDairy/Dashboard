import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';
import '../models.dart';
import '../store/cart.dart';
import '../store/distributor.dart';
import '../theme.dart';
import '../ui.dart';
import '../widgets.dart';
import 'cart_screen.dart';
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

/// "Ordering for X - Change" line under the menu's header: plain, on white.
class DistFirmBar extends ConsumerWidget {
  const DistFirmBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(distributorProvider);
    if (d.firm == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 0),
      child: Row(children: [
        const Icon(Icons.storefront_outlined, size: 22, color: Brand.ink),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Ordering for', style: TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w600)),
            Text(d.firm!.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          ]),
        ),
        if (d.firms.length > 1) TextButton(onPressed: () => ref.read(distributorProvider.notifier).selectFirm(null), child: const Text('Change')),
      ]),
    );
  }
}

String _qty(double q) => q.toStringAsFixed(q == q.roundToDouble() ? 0 : 2);

/// Status as one plain word, in sentence case ("PENDING" -> "Pending").
String _status(String s) {
  final t = s.trim().replaceAll('_', ' ');
  return t.isEmpty ? 'Placed' : t[0].toUpperCase() + t.substring(1).toLowerCase();
}

/// Orders tab: the primary orders this login placed, newest first; tap one for the full order.
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

class _DistOrderCard extends ConsumerWidget {
  const _DistOrderCard({required this.order});
  final DistOrder order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final o = order;
    final menu = ref.watch(menuProvider);
    void open() => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => DistOrderScreen(order: o)));
    final pics = o.lines.take(3).toList();

    return AppCard(
      onTap: open,
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(_status(o.status), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Brand.ink)),
          const Spacer(),
          Text(orderDate(o.date), style: const TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w600)),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          for (final (i, l) in pics.indexed)
            Container(
              margin: EdgeInsets.only(right: i == pics.length - 1 ? 0 : 6),
              width: 48,
              height: 48,
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(12)),
              child: ProductImage(url: menu.bySku(l.sku)?.image, radius: 0, fit: BoxFit.contain),
            ),
          if (o.lines.length > 3)
            Container(
              margin: const EdgeInsets.only(left: 6),
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: Brand.accentTint, borderRadius: BorderRadius.circular(12)),
              child: Text('+${o.lines.length - 3}', style: const TextStyle(fontWeight: FontWeight.w800, color: Brand.accent)),
            ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(o.lines.map((l) => '${l.name} × ${_qty(l.qty)}').join(', '),
                maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: Brand.muted, height: 1.35)),
          ),
        ]),
        const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider()),
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(rupees(o.total), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
              Text('#${o.orderId} · ${o.distributor}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Brand.faint, fontWeight: FontWeight.w600)),
            ]),
          ),
          TextButton(onPressed: open, child: const Row(mainAxisSize: MainAxisSize.min, children: [Text('Details'), Icon(Icons.chevron_right_rounded, size: 18)])),
        ]),
      ]),
    );
  }
}

/// One primary order, laid out like the customer's order page - status, what was ordered and the
/// bill, the order's details - without the live map, rider or delivery code (these orders go out
/// on the distributor's own dispatch).
class DistOrderScreen extends ConsumerWidget {
  const DistOrderScreen({super.key, required this.order});
  final DistOrder order;

  /// Puts this order's lines back in the cart at today's dealer price and opens it.
  void _orderAgain(BuildContext context, WidgetRef ref) {
    final menu = ref.read(menuProvider);
    final cart = ref.read(cartProvider.notifier);
    var added = 0;
    for (final l in order.lines) {
      final p = menu.bySku(l.sku);
      if (p == null) continue;
      for (var n = 0; n < l.qty.round(); n++) {
        cart.add(p);
      }
      added++;
    }
    if (added == 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('These items are not available right now.')));
      return;
    }
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CartScreen()));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final o = order;
    final menu = ref.watch(menuProvider);
    final status = _status(o.status);
    final totalQty = o.lines.fold<double>(0, (a, l) => a + l.qty);

    Widget band() => Container(height: 8, color: Brand.surface);
    Widget section(String t) => Padding(padding: const EdgeInsets.fromLTRB(20, 20, 20, 8), child: Text(t, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)));
    const value = TextStyle(fontSize: 14, fontWeight: FontWeight.w600, height: 1.4);
    Widget line(String k, Widget v) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 7),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 118, child: Text(k, style: const TextStyle(color: Brand.muted, fontSize: 14))),
            Expanded(child: v),
          ]),
        );
    Widget kv(String k, String v, {bool bold = false}) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(k, style: TextStyle(color: bold ? Brand.ink : Brand.muted, fontWeight: bold ? FontWeight.w800 : FontWeight.w500, fontSize: bold ? 16 : 14)),
            Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w900 : FontWeight.w600, fontSize: bold ? 16.5 : 14)),
          ]),
        );

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        title: Text('Order #${o.orderId}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider()),
      ),
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          // status
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(status, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: -0.4, color: status.toLowerCase().contains('cancel') ? Brand.danger : Brand.ink)),
              const SizedBox(height: 4),
              Text('Placed on ${orderDate(o.date)}', style: const TextStyle(fontSize: 14.5, color: Brand.muted, fontWeight: FontWeight.w500)),
            ]),
          ),
          band(),
          // what's in it
          section('Order summary'),
          for (final l in o.lines)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 9),
              child: Row(children: [
                SizedBox(width: 44, height: 44, child: ProductImage(url: menu.bySku(l.sku)?.image, radius: 10, fit: BoxFit.contain)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(l.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5)),
                    const SizedBox(height: 2),
                    Text('${_qty(l.qty)} × ${rupees(l.rate)}', style: const TextStyle(color: Brand.muted, fontSize: 13)),
                  ]),
                ),
                Text(rupees(l.amount), style: const TextStyle(fontWeight: FontWeight.w600)),
              ]),
            ),
          const Padding(padding: EdgeInsets.fromLTRB(20, 10, 20, 6), child: Divider()),
          kv('Items', '${o.lines.length}'),
          kv('Total quantity', _qty(totalQty)),
          const Padding(padding: EdgeInsets.fromLTRB(20, 6, 20, 6), child: Divider()),
          kv('Order total', rupees(o.total), bold: true),
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 2, 20, 20),
            child: Text('At your dealer price', style: TextStyle(color: Brand.muted, fontSize: 13)),
          ),
          band(),
          // the facts
          section('Order details'),
          line(
            'Order number',
            Row(children: [
              Text('#${o.orderId}', style: value),
              const SizedBox(width: 6),
              InkWell(
                borderRadius: BorderRadius.circular(6),
                onTap: () {
                  Clipboard.setData(ClipboardData(text: '${o.orderId}'));
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Order number copied')));
                },
                child: const Padding(padding: EdgeInsets.all(2), child: Icon(Icons.copy_rounded, size: 16, color: Brand.muted)),
              ),
            ]),
          ),
          line('Placed on', Text(orderDate(o.date), style: value)),
          line('Distributor', Text(o.distributor, style: value)),
          line('Status', Text(status, style: value)),
          const SizedBox(height: 28),
        ],
      ),
      bottomNavigationBar: StickyBar(
        child: FilledButton.icon(
          onPressed: () => _orderAgain(context, ref),
          icon: const Icon(Icons.replay_rounded, size: 20),
          label: const Text('Order again'),
        ),
      ),
    );
  }
}

/// Account tab for a distributor / sales officer: who they are, the distributor's full profile
/// (contact, address, GST, credit limit, sales officer), their orders at a glance, sign out.
class PartnerAccountScreen extends ConsumerWidget {
  const PartnerAccountScreen({super.key});

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
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
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(distributorProvider);
    final p = d.profile;
    if (p == null) return const SizedBox.shrink();
    final f = d.firm ?? (d.firms.length == 1 ? d.firms.first : null);
    final initials = p.name.trim().isEmpty ? '?' : p.name.trim().split(RegExp(r'\s+')).take(2).map((w) => w[0].toUpperCase()).join();
    final now = DateTime.now();
    final thisMonth = d.orders.where((o) => o.date.year == now.year && o.date.month == now.month).fold<double>(0, (a, o) => a + o.total);

    Widget band() => Container(height: 8, color: Brand.surface);
    Widget heading(String t, {Widget? action}) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, action == null ? 20 : 8, 6),
          child: Row(children: [
            Expanded(child: Text(t, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800))),
            if (action != null) action,
          ]),
        );
    const value = TextStyle(fontSize: 14, fontWeight: FontWeight.w600, height: 1.4);
    Widget line(String k, String? v, {VoidCallback? onTap}) => v == null || v.trim().isEmpty
        ? const SizedBox.shrink()
        : InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(width: 120, child: Text(k, style: const TextStyle(color: Brand.muted, fontSize: 14))),
                Expanded(child: Text(v, style: onTap == null ? value : value.copyWith(color: Brand.accent))),
              ]),
            ),
          );
    void call(String n) => launchUrl(Uri(scheme: 'tel', path: n));

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        automaticallyImplyLeading: false,
        titleSpacing: 20,
        title: const Text('Account', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      ),
      body: RefreshIndicator(
        color: Brand.accent,
        onRefresh: () async {
          final s = ref.read(distributorProvider.notifier);
          await Future.wait([s.start(), s.loadOrders()]);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            // who is signed in
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: -0.3, height: 1.2)),
                    const SizedBox(height: 4),
                    Text('+91 ${p.phone}', style: const TextStyle(fontSize: 14.5, color: Brand.muted, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 6),
                    Text(
                      [p.isSalesman ? 'Sales officer' : 'Distributor', if (!p.isSalesman && f != null && f.code.isNotEmpty) f.code].join(' · '),
                      style: const TextStyle(fontSize: 13.5, color: Brand.ink, fontWeight: FontWeight.w700),
                    ),
                  ]),
                ),
                const SizedBox(width: 16),
                CircleAvatar(radius: 34, backgroundColor: Brand.accentTint, child: Text(initials, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Brand.accent))),
              ]),
            ),
            // orders at a glance
            Container(
              margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(14)),
              child: IntrinsicHeight(
                child: Row(children: [
                  Expanded(child: _Figure(value: '${d.orders.length}', label: 'Orders')),
                  const VerticalDivider(width: 1, color: Brand.line),
                  Expanded(child: _Figure(value: rupees(thisMonth), label: 'This month')),
                ]),
              ),
            ),
            band(),
            // the distributor's profile
            if (f == null)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
                child: Text(d.loading ? 'Loading your details...' : (d.error ?? 'Choose a distributor on Home to see its details.'),
                    style: const TextStyle(color: Brand.muted)),
              )
            else ...[
              heading(
                p.isSalesman ? 'Ordering for' : 'Business details',
                action: p.isSalesman && d.firms.length > 1
                    ? TextButton(onPressed: () => ref.read(distributorProvider.notifier).selectFirm(null), child: const Text('Change'))
                    : null,
              ),
              line('Name', f.name),
              line('Code', f.code),
              line('Type', f.type),
              line('Contact person', f.contactPerson),
              line('Phone', f.phone, onTap: f.phone == null ? null : () => call(f.phone!)),
              line('Email', f.email),
              line('Address', f.fullAddress),
              const SizedBox(height: 8),
              if ([f.gstin, f.pan, f.licenceNo, f.creditLimit].any((x) => x != null)) ...[
                band(),
                heading('Tax & credit'),
                line('GSTIN', f.gstin),
                line('PAN', f.pan),
                line('Licence no.', f.licenceNo),
                line('Credit limit', f.creditLimit == null ? null : rupees(f.creditLimit!)),
                const SizedBox(height: 8),
              ],
              if (!p.isSalesman && f.salesOfficer != null) ...[
                band(),
                heading('Your sales officer'),
                line('Name', f.salesOfficer),
                line('Phone', f.salesOfficerPhone, onTap: f.salesOfficerPhone == null ? null : () => call(f.salesOfficerPhone!)),
                const SizedBox(height: 8),
              ],
            ],
            band(),
            heading('More'),
            InkWell(
              onTap: () => showLicensePage(context: context, applicationName: appName),
              child: const Padding(
                padding: EdgeInsets.fromLTRB(20, 14, 14, 14),
                child: Row(children: [
                  Icon(Icons.description_outlined, size: 22, color: Brand.ink),
                  SizedBox(width: 20),
                  Expanded(child: Text('Licences', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                  Icon(Icons.chevron_right_rounded, color: Brand.faint),
                ]),
              ),
            ),
            const Padding(padding: EdgeInsets.only(left: 62), child: Divider()),
            InkWell(
              onTap: () => _signOut(context, ref),
              child: const Padding(
                padding: EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: Row(children: [
                  Icon(Icons.logout_rounded, size: 22, color: Brand.danger),
                  SizedBox(width: 20),
                  Text('Sign out', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Brand.danger)),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        child: Column(children: [
          FittedBox(child: Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900))),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 13, color: Brand.muted, fontWeight: FontWeight.w600)),
        ]),
      );
}
