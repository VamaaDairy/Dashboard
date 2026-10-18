import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../gaia_map.dart';
import '../models.dart';
import '../state/map_state.dart';
import '../state/orders_state.dart';
import '../theme.dart';
import '../widgets.dart';

const _steps = ['placed', 'confirmed', 'out_for_delivery', 'delivered'];
const _stepLabels = ['Order placed', 'Confirmed', 'Out for delivery', 'Delivered'];

String _when(DateTime d) {
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  return '${d.day} ${m[d.month - 1]}, $h:${d.minute.toString().padLeft(2, '0')} ${d.hour >= 12 ? 'pm' : 'am'}';
}

/// One order: where it is now, what is in it, what it costs. Pull down to refresh the status.
class OrderScreen extends StatefulWidget {
  const OrderScreen({super.key, required this.order, this.justPlaced = false});
  final Order order;
  final bool justPlaced;

  @override
  State<OrderScreen> createState() => _OrderScreenState();
}

class _OrderScreenState extends State<OrderScreen> {
  late Order _order = widget.order;
  String? _error;
  RoutePath? _route;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    context.read<MapState>().load();
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
      final route = await context.read<Api>().route(GeoPoint(r.lat!, r.lng!), GeoPoint(o.lat!, o.lng!));
      if (mounted) setState(() => _route = route);
    } catch (_) {
      // the map still shows both dots; the line is a bonus
    }
  }

  Future<void> _call(String phone) => launchUrl(Uri(scheme: 'tel', path: phone));

  Future<void> _refresh() async {
    try {
      final fresh = await context.read<OrdersState>().reload(_order);
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

    return Scaffold(
      appBar: AppBar(title: Text(o.orderNo)),
      body: RefreshIndicator(
        color: Brand.accent,
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            if (widget.justPlaced && !cancelled)
              Column(
                children: [
                  const Icon(Icons.check_circle, size: 64, color: Brand.veg),
                  const SizedBox(height: 8),
                  const Text('Order placed!', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text('Pay ${rupees(o.total)} in cash on delivery.', style: const TextStyle(color: Brand.muted)),
                  const SizedBox(height: 20),
                ],
              ),
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(_error!, style: const TextStyle(color: Brand.danger))),
            _card(
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(cancelled ? 'Order cancelled' : o.statusLabel, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: cancelled ? Brand.danger : Brand.ink)),
                  Text('Placed ${_when(o.createdAt)}', style: const TextStyle(color: Brand.muted, fontSize: 13)),
                  if (!cancelled) ...[
                    const SizedBox(height: 14),
                    for (var i = 0; i < _steps.length; i++)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 5),
                        child: Row(
                          children: [
                            Icon(i <= at ? Icons.check_circle : Icons.radio_button_unchecked, size: 20, color: i <= at ? Brand.veg : Brand.faint),
                            const SizedBox(width: 10),
                            Text(_stepLabels[i], style: TextStyle(fontWeight: i == at ? FontWeight.w800 : FontWeight.w500, color: i <= at ? Brand.ink : Brand.faint)),
                          ],
                        ),
                      ),
                  ],
                ],
              ),
            ),
            ..._tracking(o),
            const SizedBox(height: 14),
            _card(
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Your items', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 6),
                  for (final i in o.items)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        children: [
                          ProductImage(url: i.image, size: 44, radius: 10),
                          const SizedBox(width: 12),
                          Expanded(child: Text.rich(TextSpan(children: [TextSpan(text: i.name, style: const TextStyle(fontWeight: FontWeight.w600)), TextSpan(text: '  × ${i.qty}', style: const TextStyle(color: Brand.faint))]))),
                          Text(rupees(i.lineTotal)),
                        ],
                      ),
                    ),
                  const Divider(height: 22),
                  _kv('Item total', rupees(o.subtotal)),
                  _kv('Delivery fee', o.deliveryFee == 0 ? 'FREE' : rupees(o.deliveryFee)),
                  const SizedBox(height: 4),
                  _kv('Total', rupees(o.total), bold: true),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _card(
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Delivering to', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 6),
                  Text(o.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text('${o.address}${o.pincode != null ? ' - ${o.pincode}' : ''}', style: const TextStyle(color: Brand.muted)),
                  Text(o.phone, style: const TextStyle(color: Brand.muted)),
                  if (o.notes != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Note: ${o.notes}', style: const TextStyle(color: Brand.muted, fontStyle: FontStyle.italic))),
                ],
              ),
            ),
            if (widget.justPlaced)
              Padding(
                padding: const EdgeInsets.only(top: 20),
                child: FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Order more')),
              ),
          ],
        ),
      ),
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
      const SizedBox(height: 14),
      if (o.hasPin && markers.isNotEmpty) ...[
        GaiaMap(markers: markers, route: _route?.points ?? const [], height: 320),
        if (out && eta.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Row(children: [
              const Icon(Icons.timelapse, size: 18, color: Brand.accent),
              const SizedBox(width: 6),
              Text('Arriving in about $eta', style: const TextStyle(fontWeight: FontWeight.w800)),
              if (_route!.distance.isNotEmpty) Text('  ·  ${_route!.distance} away', style: const TextStyle(color: Brand.muted)),
            ]),
          ),
        const SizedBox(height: 14),
      ],
      if (r != null)
        _card(Row(children: [
          const CircleAvatar(backgroundColor: Brand.accentTint, child: Icon(Icons.two_wheeler, color: Brand.accent)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(r.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              Text(out ? 'Your delivery partner is on the way' : 'Assigned to deliver your order', style: const TextStyle(color: Brand.muted, fontSize: 13)),
            ]),
          ),
          IconButton.filled(onPressed: () => _call(r.phone), icon: const Icon(Icons.call), tooltip: 'Call ${r.name}'),
        ]))
      else
        _card(const Row(children: [
          Icon(Icons.hourglass_top, color: Brand.muted),
          SizedBox(width: 12),
          Expanded(child: Text('Finding a delivery partner for your order…', style: TextStyle(fontWeight: FontWeight.w600))),
        ])),
      if (o.deliveryOtp != null) ...[
        const SizedBox(height: 14),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Brand.accentTint, borderRadius: BorderRadius.circular(16)),
          child: Row(children: [
            const Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Delivery code', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                SizedBox(height: 2),
                Text('Tell this to the delivery partner when your order arrives.', style: TextStyle(color: Brand.muted, fontSize: 13)),
              ]),
            ),
            const SizedBox(width: 12),
            Text(o.deliveryOtp!, style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, letterSpacing: 4, color: Brand.accent)),
          ]),
        ),
      ],
    ];
  }

  Widget _card(Widget child) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(16)),
        child: child,
      );

  Widget _kv(String k, String v, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(k, style: TextStyle(color: bold ? Brand.ink : Brand.muted, fontWeight: bold ? FontWeight.w800 : FontWeight.w400, fontSize: bold ? 16 : 14)),
            Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w500, fontSize: bold ? 16 : 14)),
          ],
        ),
      );
}
