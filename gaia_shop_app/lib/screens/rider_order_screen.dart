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
import 'rider_ui.dart';

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
    if (context.mounted) _toast(context, 'Delivered');
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
    final r = _route;
    final cash = o.paymentStatus != 'paid';
    final pin = o.pincode != null && o.pincode!.isNotEmpty ? ' - ${o.pincode}' : '';

    return Scaffold(
      backgroundColor: Brand.surface,
      appBar: AppBar(
        title: Text(o.orderNo),
        actions: [
          if (o.hasPin) TextButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => RiderNavigationScreen(order: o))), child: const Text('Directions')),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: ref.read(riderProvider.notifier).refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            SectionLabel('Status', trailing: Text(out ? 'On the way to customer' : 'Waiting for pick up', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Brand.ink))),
            if (o.hasPin)
              ClipRRect(
                borderRadius: BorderRadius.circular(riderRadius),
                child: GaiaMap(
                  height: 200,
                  route: r?.points ?? const [],
                  markers: [
                    MapMarker.home(GeoPoint(o.lat!, o.lng!), color: Brand.accent),
                    if (here != null) MapMarker.rider(here, heading: rider.heading),
                  ],
                ),
              )
            else
              const Text('No map pin for this order. Use the address and call the customer.', style: TextStyle(color: Brand.warn, fontWeight: FontWeight.w600, height: 1.3)),
            if (r != null && r.eta.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text('${r.eta}  ·  ${r.distance} by road', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              ),
            const SectionLabel('Customer'),
            RiderPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(o.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text('${o.address}$pin', style: const TextStyle(fontSize: 14.5, color: Brand.muted, height: 1.4)),
                  if (o.phone.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(child: Text(o.phone, style: const TextStyle(fontWeight: FontWeight.w600))),
                      OutlinedButton(onPressed: () => _call(o.phone), style: riderOutlined(), child: const Text('Call')),
                    ]),
                  ],
                  if (o.notes != null && o.notes!.trim().isNotEmpty) ...[
                    const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider()),
                    const Text('Note from customer', style: TextStyle(fontSize: 12.5, color: Brand.muted)),
                    const SizedBox(height: 2),
                    Text(o.notes!, style: const TextStyle(height: 1.35)),
                  ],
                ],
              ),
            ),
            SectionLabel('${o.itemCount} ${o.itemCount == 1 ? 'item' : 'items'}'),
            RiderPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (o.items.isEmpty) const Text('No item details on this order.', style: TextStyle(color: Brand.muted)),
                  for (final i in o.items)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(children: [
                        ProductImage(url: i.image, size: 40, radius: 6, fit: BoxFit.contain, outlined: true),
                        const SizedBox(width: 12),
                        Expanded(child: Text(i.name, style: const TextStyle(fontWeight: FontWeight.w600))),
                        const SizedBox(width: 8),
                        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                          Text('× ${i.qty}', style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text(rupees(i.lineTotal), style: const TextStyle(fontSize: 12.5, color: Brand.muted)),
                        ]),
                      ]),
                    ),
                  const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Divider()),
                  _bill('Items', rupees(o.subtotal)),
                  _bill('Delivery fee', o.deliveryFee == 0 ? 'Free' : rupees(o.deliveryFee)),
                  const SizedBox(height: 4),
                  _bill('Total', rupees(o.total), bold: true),
                ],
              ),
            ),
            const SectionLabel('Payment'),
            RiderPanel(
              child: Row(children: [
                Expanded(child: Text(cash ? 'Collect in cash' : 'Already paid', style: const TextStyle(fontWeight: FontWeight.w600))),
                Text(cash ? rupees(o.total) : 'Nothing to collect', style: TextStyle(fontWeight: FontWeight.w700, fontSize: cash ? 20 : 14, color: cash ? Brand.ink : Brand.muted)),
              ]),
            ),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.paddingOf(context).bottom),
        decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Brand.line))),
        child: _busy
            ? const SizedBox(height: 48, child: Center(child: CircularProgressIndicator(color: Brand.accent)))
            : FilledButton(
                onPressed: () => out ? _run(() => riderDeliverFlow(context, ref, o), closeAfter: true) : _run(() => riderPickupFlow(context, ref, o)),
                style: riderFilled(),
                child: Text(out ? 'Mark delivered' : 'Picked up'),
              ),
      ),
    );
  }

  Widget _bill(String k, String v, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Expanded(child: Text(k, style: TextStyle(color: bold ? Brand.ink : Brand.muted, fontWeight: bold ? FontWeight.w700 : FontWeight.w500))),
          Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w700 : FontWeight.w600, fontSize: bold ? 16 : 14.5)),
        ]),
      );
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
          const Text('Delivery code', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text('Collect ${rupees(widget.amount)} in cash, then ask the customer for the 4-digit code on their order screen.', style: const TextStyle(color: Brand.muted, height: 1.35)),
          const SizedBox(height: 18),
          TextField(
            controller: _otp,
            autofocus: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: 10),
            decoration: const InputDecoration(counterText: ''),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _otp.text.trim().length == 4 ? () => Navigator.pop(context, _otp.text.trim()) : null,
            style: riderFilled(),
            child: const Text('Confirm delivery'),
          ),
        ],
      ),
    );
  }
}
