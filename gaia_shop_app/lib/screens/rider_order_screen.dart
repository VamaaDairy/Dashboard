import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../gaia_map.dart';
import '../models.dart';
import '../store/core.dart';
import '../store/rider.dart';
import '../theme.dart';
import '../widgets.dart';
import 'rider_navigation_screen.dart';

const _orange = Color(0xFFE8590C);

void _toast(BuildContext context, String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

/// "Picked up": the order goes out for delivery. Returns true when the server accepted it.
Future<bool> riderPickupFlow(BuildContext context, WidgetRef ref, Order o) async {
  try {
    await ref.read(riderProvider.notifier).pickup(o);
    return true;
  } on ApiException catch (e) {
    if (context.mounted) _toast(context, e.message);
  } catch (_) {
    if (context.mounted) _toast(context, 'Something went wrong. Please try again.');
  }
  return false;
}

/// "Delivered": asks for the customer's 4-digit code and completes the order with it.
Future<bool> riderDeliverFlow(BuildContext context, WidgetRef ref, Order o) async {
  final otp = await showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _OtpSheet(amount: o.total),
  );
  if (otp == null || !context.mounted) return false;
  try {
    await ref.read(riderProvider.notifier).deliver(o, otp);
    if (context.mounted) _toast(context, 'Delivered. Well done!');
    return true;
  } on ApiException catch (e) {
    if (context.mounted) _toast(context, e.message);
  } catch (_) {
    if (context.mounted) _toast(context, 'Something went wrong. Please try again.');
  }
  return false;
}

/// One delivery in full: where, who, what is in the bag, what to collect, and the two steps - picked up, delivered.
class RiderOrderScreen extends ConsumerStatefulWidget {
  const RiderOrderScreen({super.key, required this.orderNo});
  final String orderNo;

  @override
  ConsumerState<RiderOrderScreen> createState() => _RiderOrderScreenState();
}

class _RiderOrderScreenState extends ConsumerState<RiderOrderScreen> {
  RoutePath? _route;
  GeoPoint? _routedFrom;
  bool _busy = false;

  Order? _find(RiderData s) {
    for (final o in s.orders) {
      if (o.orderNo == widget.orderNo) return o;
    }
    return null;
  }

  Future<void> _loadRoute(Order o, GeoPoint? here) async {
    if (!o.hasPin || here == null) return;
    // only re-ask for the route once the rider has moved a fair way
    final last = _routedFrom;
    if (last != null && (last.lat - here.lat).abs() < 0.0008 && (last.lng - here.lng).abs() < 0.0008) return;
    _routedFrom = here;
    try {
      final r = await ref.read(apiProvider).route(here, GeoPoint(o.lat!, o.lng!));
      if (mounted) setState(() => _route = r);
    } catch (_) {
      // the dots are still on the map
    }
  }

  Future<void> _run(Future<bool> Function() action, {bool closeAfter = false}) async {
    setState(() => _busy = true);
    final ok = await action();
    if (!mounted) return;
    if (ok && closeAfter) {
      Navigator.of(context).pop();
      return;
    }
    setState(() => _busy = false);
  }

  Future<void> _call(String phone) => launchUrl(Uri(scheme: 'tel', path: phone));

  @override
  Widget build(BuildContext context) {
    final rider = ref.watch(riderProvider);
    final o = _find(rider);
    if (o == null) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.orderNo)),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: Text('This delivery is no longer on your list.', textAlign: TextAlign.center, style: TextStyle(fontSize: 16, color: Brand.muted)),
          ),
        ),
      );
    }
    final here = rider.here;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadRoute(o, here);
    });
    final out = o.status == 'out_for_delivery';
    final tone = out ? _orange : Brand.veg;
    final r = _route;
    final cash = o.paymentStatus != 'paid';

    return Scaffold(
      appBar: AppBar(
        title: Text(o.orderNo),
        actions: [
          if (o.hasPin) TextButton.icon(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => RiderNavigationScreen(order: o))), icon: const Icon(Icons.navigation, size: 20), label: const Text('Directions')),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: ref.read(riderProvider.notifier).refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            _Steps(out: out),
            const SizedBox(height: 16),
            if (o.hasPin)
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: GaiaMap(
                  height: 230,
                  route: r?.points ?? const [],
                  markers: [
                    MapMarker.home(GeoPoint(o.lat!, o.lng!), color: tone),
                    if (here != null) MapMarker.rider(here, heading: rider.heading),
                  ],
                ),
              )
            else
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: const Color(0xFFFFF4E5), borderRadius: BorderRadius.circular(14)),
                child: const Text('No map pin for this order - use the address and call the customer.', style: TextStyle(color: Color(0xFF8A5A00), fontWeight: FontWeight.w700)),
              ),
            if (r != null && r.eta.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Row(children: [
                  const Icon(Icons.schedule, size: 20, color: Brand.veg),
                  const SizedBox(width: 6),
                  Text(r.eta, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: Brand.veg)),
                  Text('  ·  ${r.distance} by road', style: const TextStyle(fontWeight: FontWeight.w700, color: Brand.muted)),
                ]),
              ),
            const SizedBox(height: 16),
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('DELIVER TO', style: _label),
                        const SizedBox(height: 6),
                        Text(o.name, style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 4),
                        Text('${o.address}${o.pincode != null && o.pincode!.isNotEmpty ? ' - ${o.pincode}' : ''}', style: const TextStyle(fontSize: 14.5, color: Brand.muted, height: 1.4)),
                        if (o.phone.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(o.phone, style: const TextStyle(fontWeight: FontWeight.w700)),
                        ],
                      ]),
                    ),
                    const SizedBox(width: 12),
                    if (o.phone.isNotEmpty) _RoundAction(icon: Icons.call, label: 'Call', color: Brand.veg, onTap: () => _call(o.phone)),
                  ]),
                  if (o.notes != null && o.notes!.trim().isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: const Color(0xFFFFF8E1), borderRadius: BorderRadius.circular(12)),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Icon(Icons.sticky_note_2_outlined, size: 20, color: Color(0xFF8A5A00)),
                        const SizedBox(width: 8),
                        Expanded(child: Text(o.notes!, style: const TextStyle(color: Color(0xFF5C4300), height: 1.35))),
                      ]),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${o.itemCount} ${o.itemCount == 1 ? 'ITEM' : 'ITEMS'} TO HAND OVER', style: _label),
                  const SizedBox(height: 8),
                  if (o.items.isEmpty) const Text('No item details on this order.', style: TextStyle(color: Brand.muted)),
                  for (final i in o.items)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(children: [
                        ProductImage(url: i.image, size: 46, radius: 10, fit: BoxFit.contain, outlined: true),
                        const SizedBox(width: 12),
                        Expanded(child: Text(i.name, style: const TextStyle(fontWeight: FontWeight.w600))),
                        const SizedBox(width: 8),
                        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                          Text('× ${i.qty}', style: const TextStyle(fontWeight: FontWeight.w900)),
                          Text(rupees(i.lineTotal), style: const TextStyle(fontSize: 12.5, color: Brand.muted)),
                        ]),
                      ]),
                    ),
                  const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Divider(height: 1, color: Brand.line)),
                  _bill('Items', rupees(o.subtotal)),
                  _bill('Delivery fee', o.deliveryFee == 0 ? 'Free' : rupees(o.deliveryFee)),
                  const SizedBox(height: 4),
                  _bill('Total', rupees(o.total), bold: true),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: cash ? Brand.accentTint : const Color(0xFFE8F5EC), borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                Icon(cash ? Icons.payments_outlined : Icons.verified_outlined, color: cash ? Brand.accent : Brand.veg, size: 26),
                const SizedBox(width: 12),
                Expanded(child: Text(cash ? 'Collect in cash' : 'Already paid', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                Text(cash ? rupees(o.total) : rupees(0), style: TextStyle(fontWeight: FontWeight.w900, fontSize: 24, color: cash ? Brand.accent : Brand.veg)),
              ]),
            ),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.paddingOf(context).bottom),
        decoration: const BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -2))]),
        child: _busy
            ? const SizedBox(height: 56, child: Center(child: CircularProgressIndicator(color: Brand.accent)))
            : !out
                ? FilledButton.icon(
                    onPressed: () => _run(() => riderPickupFlow(context, ref, o)),
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
                    icon: const Icon(Icons.inventory_2_outlined),
                    label: const Text('Picked up · start delivery'),
                  )
                : FilledButton.icon(
                    onPressed: () => _run(() => riderDeliverFlow(context, ref, o), closeAfter: true),
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56), backgroundColor: Brand.veg),
                    icon: const Icon(Icons.check_circle_outline),
                    label: const Text('Delivered · enter code'),
                  ),
      ),
    );
  }

  Widget _bill(String k, String v, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Expanded(child: Text(k, style: TextStyle(color: bold ? Brand.ink : Brand.muted, fontWeight: bold ? FontWeight.w800 : FontWeight.w600))),
          Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w900 : FontWeight.w700, fontSize: bold ? 17 : 14.5)),
        ]),
      );
}

const _label = TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: Brand.faint);

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Brand.line)),
        child: child,
      );
}

/// Pick up -> On the way -> Delivered, with where this order is now.
class _Steps extends StatelessWidget {
  const _Steps({required this.out});
  final bool out;

  @override
  Widget build(BuildContext context) {
    final at = out ? 1 : 0;
    Widget dot(int i, IconData icon, String label) {
      final done = i < at, now = i == at;
      final c = done || now ? Brand.accent : Brand.faint;
      return Expanded(
        child: Column(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: done ? Brand.accent : (now ? Brand.accentTint : Brand.surface), shape: BoxShape.circle, border: Border.all(color: c, width: now ? 2 : 1)),
            child: Icon(done ? Icons.check : icon, size: 18, color: done ? Colors.white : c),
          ),
          const SizedBox(height: 6),
          Text(label, style: TextStyle(fontSize: 12.5, fontWeight: now ? FontWeight.w800 : FontWeight.w600, color: now ? Brand.ink : Brand.muted)),
        ]),
      );
    }

    Widget line(int i) => Expanded(child: Container(height: 2, margin: const EdgeInsets.only(bottom: 22), color: i < at ? Brand.accent : Brand.line));

    return Row(children: [
      dot(0, Icons.storefront_outlined, 'Pick up'),
      line(0),
      dot(1, Icons.two_wheeler, 'On the way'),
      line(1),
      dot(2, Icons.home_outlined, 'Delivered'),
    ]);
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({required this.icon, required this.label, required this.color, required this.onTap});
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Column(children: [
        Material(
          color: color,
          shape: const CircleBorder(),
          child: InkWell(customBorder: const CircleBorder(), onTap: onTap, child: SizedBox(width: 52, height: 52, child: Icon(icon, color: Colors.white))),
        ),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
      ]);
}

/// The customer reads out their 4-digit code; the order is only completed with it.
class _OtpSheet extends StatefulWidget {
  const _OtpSheet({required this.amount});
  final double amount;

  @override
  State<_OtpSheet> createState() => _OtpSheetState();
}

class _OtpSheetState extends State<_OtpSheet> {
  final _otp = TextEditingController();

  @override
  void dispose() {
    _otp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 0, 24, MediaQuery.viewInsetsOf(context).bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Delivery code', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('Collect ${rupees(widget.amount)} in cash, then ask the customer for the 4-digit code on their order screen.', style: const TextStyle(color: Brand.muted, height: 1.35)),
          const SizedBox(height: 18),
          TextField(
            controller: _otp,
            autofocus: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, letterSpacing: 10),
            decoration: const InputDecoration(counterText: ''),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _otp.text.trim().length == 4 ? () => Navigator.pop(context, _otp.text.trim()) : null,
            child: const Text('Confirm delivery'),
          ),
        ],
      ),
    );
  }
}
