import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../gaia_map.dart';
import '../models.dart';
import '../store/account.dart';
import '../store/core.dart';
import '../store/map.dart';
import '../theme.dart';
import '../ui.dart';
import '../widgets.dart';
import 'orders_screen.dart';

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

  @override
  Widget build(BuildContext context) {
    final o = _order;
    final cancelled = o.status == 'cancelled';
    final at = _steps.indexOf(o.status);
    final (color, icon) = statusLook(o.status);

    return Scaffold(
      backgroundColor: Brand.surface,
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(o.orderNo),
          Text(orderDate(o.createdAt), style: const TextStyle(fontSize: 12.5, color: Brand.muted, fontWeight: FontWeight.w600)),
        ]),
      ),
      body: RefreshIndicator(
        color: Brand.accent,
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            if (widget.justPlaced && !cancelled) ...[
              const SizedBox(height: 8),
              Center(
                child: Container(
                  width: 92,
                  height: 92,
                  decoration: BoxDecoration(color: Brand.veg.withValues(alpha: 0.12), shape: BoxShape.circle),
                  child: Center(
                    child: Container(
                      width: 64,
                      height: 64,
                      decoration: const BoxDecoration(color: Brand.veg, shape: BoxShape.circle),
                      child: const Icon(Icons.check_rounded, size: 40, color: Colors.white),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              const Center(child: Text('Order placed!', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900))),
              const SizedBox(height: 4),
              Center(child: Text('Pay ${rupees(o.total)} in cash when it arrives', style: const TextStyle(color: Brand.muted, fontWeight: FontWeight.w600))),
              const SizedBox(height: 22),
            ],
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(_error!, style: const TextStyle(color: Brand.danger))),
            // where it is now
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  IconTile(icon, color: color, size: 46),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(cancelled ? 'Order cancelled' : o.statusLabel, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: cancelled ? Brand.danger : Brand.ink)),
                      Text(
                        switch (o.status) {
                          'placed' => 'We have your order and will confirm it shortly',
                          'confirmed' => 'Being packed for delivery',
                          'out_for_delivery' => 'Your delivery partner is on the way',
                          'delivered' => 'Delivered. Enjoy!',
                          _ => 'This order will not be delivered',
                        },
                        style: const TextStyle(color: Brand.muted, fontSize: 13),
                      ),
                    ]),
                  ),
                ]),
                if (!cancelled) ...[
                  const SizedBox(height: 18),
                  _Progress(at: at),
                ],
              ]),
            ),
            ..._tracking(o),
            const SizedBox(height: 12),
            // what's in it
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${o.itemCount} ${o.itemCount == 1 ? 'item' : 'items'}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                const SizedBox(height: 6),
                for (final i in o.items)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    child: Row(children: [
                      Container(
                        width: 46,
                        height: 46,
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(12)),
                        child: ProductImage(url: i.image, radius: 0, fit: BoxFit.contain),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(i.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text('${i.qty} × ${rupees(i.unitPrice)}', style: const TextStyle(color: Brand.muted, fontSize: 12.5)),
                        ]),
                      ),
                      Text(rupees(i.lineTotal), style: const TextStyle(fontWeight: FontWeight.w700)),
                    ]),
                  ),
                const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Divider()),
                _kv('Item total', rupees(o.subtotal)),
                _kv('Delivery fee', o.deliveryFee == 0 ? 'FREE' : rupees(o.deliveryFee), good: o.deliveryFee == 0),
                const SizedBox(height: 6),
                _kv(o.paymentStatus == 'paid' ? 'Paid' : 'To pay in cash', rupees(o.total), bold: true),
              ]),
            ),
            const SizedBox(height: 12),
            // where it goes
            AppCard(
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const IconTile(Icons.location_on_outlined),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Delivering to', style: TextStyle(fontSize: 12.5, color: Brand.muted, fontWeight: FontWeight.w600)),
                    Text(o.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    const SizedBox(height: 2),
                    Text('${o.address}${o.pincode != null ? ' - ${o.pincode}' : ''}', style: const TextStyle(color: Brand.muted, height: 1.35)),
                    Text(o.phone, style: const TextStyle(color: Brand.muted)),
                    if (o.notes != null && o.notes!.trim().isNotEmpty)
                      Padding(padding: const EdgeInsets.only(top: 6), child: Text('Note: ${o.notes}', style: const TextStyle(color: Brand.muted, fontStyle: FontStyle.italic))),
                  ]),
                ),
              ]),
            ),
          ],
        ),
      ),
      bottomNavigationBar: widget.justPlaced
          ? StickyBar(child: FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Continue shopping')))
          : null,
    );
  }

  /// The live part: map with the rider coming, who is bringing it, and the code to hand over.
  List<Widget> _tracking(Order o) {
    if (!o.isOpen || o.status == 'placed') return [];
    final r = o.rider;
    final out = o.status == 'out_for_delivery';
    final markers = <MapMarker>[
      if (o.hasPin) MapMarker.home(GeoPoint(o.lat!, o.lng!)),
      if (out && r != null && r.hasPosition) MapMarker.rider(GeoPoint(r.lat!, r.lng!)),
    ];
    final eta = _route?.eta ?? '';
    return [
      const SizedBox(height: 12),
      if (o.hasPin && markers.isNotEmpty)
        ClipRRect(
          borderRadius: BorderRadius.circular(Brand.radius),
          child: Stack(children: [
            GaiaMap(markers: markers, route: _route?.points ?? const [], height: 300, radius: 0),
            if (out && eta.isNotEmpty)
              Positioned(
                left: 12,
                top: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: Brand.lift),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.schedule_rounded, size: 18, color: Brand.veg),
                    const SizedBox(width: 6),
                    Text(eta, style: const TextStyle(fontWeight: FontWeight.w900, color: Brand.veg)),
                    if (_route!.distance.isNotEmpty) Text('  ·  ${_route!.distance}', style: const TextStyle(color: Brand.muted, fontWeight: FontWeight.w600)),
                  ]),
                ),
              ),
          ]),
        ),
      const SizedBox(height: 12),
      AppCard(
        padding: const EdgeInsets.all(14),
        child: r != null
            ? Row(children: [
                const CircleAvatar(radius: 24, backgroundColor: Brand.accentTint, child: Icon(Icons.two_wheeler_rounded, color: Brand.accent)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(r.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5)),
                    Text(out ? 'Your delivery partner' : 'Will deliver your order', style: const TextStyle(color: Brand.muted, fontSize: 13)),
                  ]),
                ),
                Material(
                  color: Brand.veg,
                  shape: const CircleBorder(),
                  child: IconButton(onPressed: () => _call(r.phone), icon: const Icon(Icons.call_rounded, color: Colors.white), tooltip: 'Call ${r.name}'),
                ),
              ])
            : const Row(children: [
                SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4)),
                SizedBox(width: 14),
                Expanded(child: Text('Assigning a delivery partner…', style: TextStyle(fontWeight: FontWeight.w700))),
              ]),
      ),
      if (o.deliveryOtp != null) ...[
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Brand.accent, Brand.accentDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(Brand.radius),
          ),
          child: Row(children: [
            const Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Delivery code', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5, color: Colors.white)),
                SizedBox(height: 2),
                Text('Share it with the delivery partner at your door', style: TextStyle(color: Colors.white70, fontSize: 12.5)),
              ]),
            ),
            const SizedBox(width: 10),
            for (final ch in o.deliveryOtp!.split(''))
              Container(
                margin: const EdgeInsets.only(left: 5),
                width: 34,
                height: 42,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
                child: Text(ch, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Brand.accent)),
              ),
          ]),
        ),
      ],
    ];
  }

  Widget _kv(String k, String v, {bool bold = false, bool good = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(k, style: TextStyle(color: bold ? Brand.ink : Brand.muted, fontWeight: bold ? FontWeight.w800 : FontWeight.w500, fontSize: bold ? 16.5 : 14)),
            Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w900 : FontWeight.w600, fontSize: bold ? 17 : 14, color: good ? Brand.veg : Brand.ink)),
          ],
        ),
      );
}

/// Placed -> Confirmed -> On the way -> Delivered as dots on a line.
class _Progress extends StatelessWidget {
  const _Progress({required this.at});
  final int at;

  @override
  Widget build(BuildContext context) {
    const labels = ['Placed', 'Confirmed', 'On the way', 'Delivered'];
    return Column(children: [
      Row(children: [
        for (var i = 0; i < 4; i++) ...[
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: i <= at ? Brand.veg : Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: i <= at ? Brand.veg : Brand.line, width: 2),
            ),
            child: i <= at ? const Icon(Icons.check_rounded, size: 14, color: Colors.white) : null,
          ),
          if (i < 3) Expanded(child: Container(height: 3, margin: const EdgeInsets.symmetric(horizontal: 4), decoration: BoxDecoration(color: i < at ? Brand.veg : Brand.line, borderRadius: BorderRadius.circular(2)))),
        ],
      ]),
      const SizedBox(height: 8),
      Row(children: [
        for (var i = 0; i < 4; i++)
          Expanded(
            child: Text(
              labels[i],
              textAlign: i == 0 ? TextAlign.left : (i == 3 ? TextAlign.right : TextAlign.center),
              style: TextStyle(fontSize: 11.5, fontWeight: i == at ? FontWeight.w800 : FontWeight.w600, color: i <= at ? Brand.ink : Brand.faint),
            ),
          ),
      ]),
    ]);
  }
}
