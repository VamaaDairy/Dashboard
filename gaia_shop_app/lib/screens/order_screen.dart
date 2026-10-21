import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../gaia_map.dart';
import '../models.dart';
import '../store/account.dart';
import '../store/cart.dart';
import '../store/catalog.dart';
import '../store/core.dart';
import '../store/map.dart';
import '../theme.dart';
import '../ui.dart';
import '../widgets.dart';
import 'cart_screen.dart';

const _steps = ['placed', 'confirmed', 'out_for_delivery', 'delivered'];


/// One order: where it is now, what is in it, what it costs. Pull down to refresh the status.
class OrderScreen extends ConsumerStatefulWidget {
  const OrderScreen({super.key, required this.order, this.justPlaced = false});
  final Order order;
  final bool justPlaced;

  @override
  ConsumerState<OrderScreen> createState() => _OrderScreenState();
}

class _OrderScreenState extends ConsumerState<OrderScreen> {
  late Order _order = widget.order;
  String? _error;
  RoutePath? _route;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    ref.read(mapProvider.notifier).load();
    _loadRoute();
    // while the order is on its way, the status, the rider and the route stay current by themselves
    _timer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (_order.isOpen) _refresh();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _loadRoute() async {
    final o = _order;
    final r = o.rider;
    if (!o.hasPin || r == null || !r.hasPosition || o.status != 'out_for_delivery') {
      if (_route != null && mounted) setState(() => _route = null);
      return;
    }
    try {
      final route = await ref.read(apiProvider).route(GeoPoint(r.lat!, r.lng!), GeoPoint(o.lat!, o.lng!));
      if (mounted) setState(() => _route = route);
    } catch (_) {
      // the map still shows both dots; the line is a bonus
    }
  }

  Future<void> _call(String phone) => launchUrl(Uri(scheme: 'tel', path: phone));

  Future<void> _refresh() async {
    try {
      final fresh = await ref.read(accountProvider.notifier).reload(_order);
      if (!mounted) return;
      setState(() {
        _order = fresh;
        _error = null;
      });
      _loadRoute();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not refresh. Check your connection.');
    }
  }

  /// Puts this order's items back in the cart (current prices) and opens it.
  void _orderAgain() {
    final menu = ref.read(catalogProvider);
    final cart = ref.read(cartProvider.notifier);
    var added = 0;
    for (final it in _order.items) {
      final p = menu.bySku(it.sku);
      if (p == null) continue;
      for (var n = 0; n < it.qty; n++) {
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

  String _clock(DateTime d) {
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    return '$h:${d.minute.toString().padLeft(2, '0')} ${d.hour >= 12 ? 'PM' : 'AM'}';
  }

  String _day(DateTime d) {
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final now = DateTime.now();
    if (d.year == now.year && d.month == now.month && d.day == now.day) return 'Today';
    return '${d.day} ${m[d.month - 1]} ${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final o = _order;
    final cancelled = o.status == 'cancelled';
    final delivered = o.status == 'delivered';
    final out = o.status == 'out_for_delivery';
    final at = _steps.indexOf(o.status);
    final r = o.rider;
    final eta = _route?.eta ?? '';
    final showMap = o.isOpen && o.status != 'placed' && o.hasPin;

    // the one line that matters, big - like the food apps do it
    final (String title, String sub) = switch (o.status) {
      'placed' => (widget.justPlaced ? 'Order placed' : 'Order received', 'We will confirm it in a moment'),
      'confirmed' => ('Order confirmed', r != null ? '${r.name} will bring it to you' : 'Being packed for delivery'),
      'out_for_delivery' => (eta.isNotEmpty ? 'Arriving in $eta' : 'On the way', r != null ? '${r.name} is on the way to you' : 'Your order is on the way'),
      'delivered' => ('Delivered', o.deliveredAt != null ? 'on ${_day(o.deliveredAt!)} at ${_clock(o.deliveredAt!)}' : 'Your order was delivered'),
      _ => ('Order cancelled', 'This order will not be delivered'),
    };

    Widget band() => Container(height: 8, color: Brand.surface);
    Widget section(String t) => Padding(padding: const EdgeInsets.fromLTRB(20, 20, 20, 8), child: Text(t, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)));
    Widget line(String k, Widget v) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 7),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 118, child: Text(k, style: const TextStyle(color: Brand.muted, fontSize: 14))),
            Expanded(child: v),
          ]),
        );
    const value = TextStyle(fontSize: 14, fontWeight: FontWeight.w600, height: 1.4);

    return Scaffold(
      appBar: AppBar(
        title: Text('Order ${o.orderNo}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider()),
      ),
      body: RefreshIndicator(
        color: Brand.accent,
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
            if (showMap)
              GaiaMap(
                height: 240,
                radius: 0,
                route: _route?.points ?? const [],
                markers: [
                  MapMarker.home(GeoPoint(o.lat!, o.lng!)),
                  if (out && r != null && r.hasPosition) MapMarker.rider(GeoPoint(r.lat!, r.lng!)),
                ],
              ),
            // status
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: -0.4, color: cancelled ? Brand.danger : Brand.ink)),
                const SizedBox(height: 4),
                Text(sub, style: const TextStyle(fontSize: 14.5, color: Brand.muted, fontWeight: FontWeight.w500)),
                if (!cancelled && !delivered) ...[
                  const SizedBox(height: 16),
                  Row(children: [
                    for (var i = 0; i < 4; i++) ...[
                      Expanded(
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          height: 4,
                          decoration: BoxDecoration(color: i <= at ? Brand.veg : Brand.line, borderRadius: BorderRadius.circular(2)),
                        ),
                      ),
                      if (i < 3) const SizedBox(width: 6),
                    ],
                  ]),
                  const SizedBox(height: 8),
                  Text(
                    const ['Order received', 'Confirmed and packing', 'Out for delivery', 'Delivered'][at < 0 ? 0 : at],
                    style: const TextStyle(fontSize: 12.5, color: Brand.muted, fontWeight: FontWeight.w600),
                  ),
                ],
              ]),
            ),
            if (_error != null) Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 12), child: Text(_error!, style: const TextStyle(color: Brand.danger))),
            // who is bringing it, and the code for the door
            if (o.isOpen && (r != null || o.deliveryOtp != null)) ...[
              const Divider(),
              if (r != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 16, 14),
                  child: Row(children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: Brand.surface,
                      child: Text(r.name.isEmpty ? '?' : r.name[0].toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: Brand.ink)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(r.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5)),
                        const Text('Delivery partner', style: TextStyle(color: Brand.muted, fontSize: 13)),
                      ]),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => _call(r.phone),
                      style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 14), shape: const StadiumBorder(), side: const BorderSide(color: Brand.line)),
                      icon: const Icon(Icons.call_outlined, size: 18),
                      label: const Text('Call', style: TextStyle(fontSize: 14)),
                    ),
                  ]),
                ),
              if (r != null && o.deliveryOtp != null) const Padding(padding: EdgeInsets.only(left: 20), child: Divider()),
              if (o.deliveryOtp != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
                  child: Row(children: [
                    const Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Delivery code', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                        SizedBox(height: 2),
                        Text('Share it with the delivery partner when they arrive', style: TextStyle(color: Brand.muted, fontSize: 13)),
                      ]),
                    ),
                    const SizedBox(width: 12),
                    Text(o.deliveryOtp!.split('').join(' '), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: 2)),
                  ]),
                ),
            ],
            band(),
            // what's in it
            section('Order summary'),
            for (final i in o.items)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 9),
                child: Row(children: [
                  SizedBox(width: 44, height: 44, child: ProductImage(url: i.image, radius: 10, fit: BoxFit.contain)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(i.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14.5)),
                      const SizedBox(height: 2),
                      Text('${i.qty} × ${rupees(i.unitPrice)}', style: const TextStyle(color: Brand.muted, fontSize: 13)),
                    ]),
                  ),
                  Text(rupees(i.lineTotal), style: const TextStyle(fontWeight: FontWeight.w600)),
                ]),
              ),
            const Padding(padding: EdgeInsets.fromLTRB(20, 10, 20, 6), child: Divider()),
            _kv('Item total', rupees(o.subtotal)),
            _kv('Delivery fee', o.deliveryFee == 0 ? 'FREE' : rupees(o.deliveryFee), good: o.deliveryFee == 0),
            const Padding(padding: EdgeInsets.fromLTRB(20, 6, 20, 6), child: Divider()),
            _kv('Grand total', rupees(o.total), bold: true),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 2, 20, 20),
              child: Text(
                o.paymentStatus == 'paid' ? 'Paid in cash' : (cancelled ? 'Nothing to pay' : 'Pay in cash on delivery'),
                style: const TextStyle(color: Brand.muted, fontSize: 13),
              ),
            ),
            band(),
            // the facts
            section('Order details'),
            line(
              'Order number',
              Row(children: [
                Text(o.orderNo, style: value),
                const SizedBox(width: 6),
                InkWell(
                  borderRadius: BorderRadius.circular(6),
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: o.orderNo));
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Order number copied')));
                  },
                  child: const Padding(padding: EdgeInsets.all(2), child: Icon(Icons.copy_rounded, size: 16, color: Brand.muted)),
                ),
              ]),
            ),
            line('Placed on', Text('${_day(o.createdAt)}, ${_clock(o.createdAt)}', style: value)),
            line('Payment', const Text('Cash on delivery', style: value)),
            line(
              'Deliver to',
              Text(
                [o.name, '${o.address}${o.pincode != null ? ' - ${o.pincode}' : ''}', o.phone].join('\n'),
                style: value,
              ),
            ),
            if (o.notes != null && o.notes!.trim().isNotEmpty) line('Note', Text(o.notes!, style: value)),
            const SizedBox(height: 28),
          ],
        ),
      ),
      bottomNavigationBar: widget.justPlaced
          ? StickyBar(child: FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Continue shopping')))
          : (!o.isOpen
              ? StickyBar(
                  child: FilledButton.icon(
                    onPressed: _orderAgain,
                    icon: const Icon(Icons.replay_rounded, size: 20),
                    label: const Text('Order again'),
                  ),
                )
              : null),
    );
  }

  Widget _kv(String k, String v, {bool bold = false, bool good = false}) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(k, style: TextStyle(color: bold ? Brand.ink : Brand.muted, fontWeight: bold ? FontWeight.w800 : FontWeight.w500, fontSize: bold ? 16 : 14)),
            Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w900 : FontWeight.w600, fontSize: bold ? 16.5 : 14, color: good ? Brand.veg : Brand.ink)),
          ],
        ),
      );
}
