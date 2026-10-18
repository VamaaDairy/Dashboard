import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../gaia_map.dart';
import '../models.dart';
import '../state/rider_state.dart';
import '../theme.dart';
import '../widgets.dart';
import 'rider_navigation_screen.dart';

/// One delivery: the map to the customer, who they are, what to hand over, and the two steps - picked up, delivered.
class RiderOrderScreen extends StatefulWidget {
  const RiderOrderScreen({super.key, required this.orderNo});
  final String orderNo;

  @override
  State<RiderOrderScreen> createState() => _RiderOrderScreenState();
}

class _RiderOrderScreenState extends State<RiderOrderScreen> {
  RoutePath? _route;
  GeoPoint? _routedFrom;
  bool _busy = false;

  Order? _find(RiderState s) {
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
      final r = await context.read<Api>().route(here, GeoPoint(o.lat!, o.lng!));
      if (mounted) setState(() => _route = r);
    } catch (_) {
      // the dots are still on the map
    }
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _pickup(Order o) async {
    setState(() => _busy = true);
    try {
      await context.read<RiderState>().pickup(o);
    } on ApiException catch (e) {
      _toast(e.message);
    } catch (_) {
      _toast('Something went wrong. Please try again.');
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _deliver(Order o) async {
    final otp = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _OtpSheet(amount: o.total),
    );
    if (otp == null || !mounted) return;
    final rider = context.read<RiderState>();
    final nav = Navigator.of(context);
    setState(() => _busy = true);
    try {
      await rider.deliver(o, otp);
      if (!mounted) return;
      _toast('Delivered. Well done!');
      nav.pop();
    } on ApiException catch (e) {
      _toast(e.message);
    } catch (_) {
      _toast('Something went wrong. Please try again.');
    }
    if (mounted) setState(() => _busy = false);
  }

  /// Turn-by-turn on Ola Maps inside the app.
  Future<void> _navigate(Order o) => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => RiderNavigationScreen(order: o)));

  @override
  Widget build(BuildContext context) {
    final rider = context.watch<RiderState>();
    final o = _find(rider);
    if (o == null) {
      return Scaffold(appBar: AppBar(), body: const Center(child: Text('This delivery is no longer on your list.')));
    }
    final here = rider.here;
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadRoute(o, here));
    final out = o.status == 'out_for_delivery';

    return Scaffold(
      appBar: AppBar(title: Text(o.orderNo)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          if (o.hasPin) ...[
            GaiaMap(
              height: 340,
              route: _route?.points ?? const [],
              markers: [
                MapMarker(GeoPoint(o.lat!, o.lng!), Brand.gaiaGreen, radius: 10),
                if (here != null) MapMarker(here, Brand.accent, radius: 11),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Row(children: [
                if (_route != null && _route!.eta.isNotEmpty) ...[
                  const Icon(Icons.timelapse, size: 18, color: Brand.accent),
                  const SizedBox(width: 6),
                  Text('${_route!.eta} · ${_route!.distance}', style: const TextStyle(fontWeight: FontWeight.w800)),
                ],
                const Spacer(),
                FilledButton.icon(
                  onPressed: () => _navigate(o),
                  style: FilledButton.styleFrom(minimumSize: const Size(150, 44)),
                  icon: const Icon(Icons.navigation, size: 18),
                  label: const Text('Start navigation'),
                ),
              ]),
            ),
            if (_route != null && _route!.steps.isNotEmpty)
              Theme(
                data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                child: ExpansionTile(
                  tilePadding: EdgeInsets.zero,
                  title: Text('Directions (${_route!.steps.length} steps)', style: const TextStyle(fontWeight: FontWeight.w800)),
                  children: [
                    for (final t in _route!.steps)
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(maneuverIcon(t.maneuver), color: Brand.accent),
                        title: Text(t.text),
                        trailing: Text(t.distance, style: const TextStyle(color: Brand.muted)),
                      ),
                  ],
                ),
              ),
          ] else
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFFFF4E5), borderRadius: BorderRadius.circular(12)),
              child: const Text('The customer did not set a map pin. Use the address below and call them if needed.', style: TextStyle(color: Color(0xFF8A5A00), fontWeight: FontWeight.w600)),
            ),
          const SizedBox(height: 16),
          _card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(o.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17))),
              IconButton.filled(onPressed: () => launchUrl(Uri(scheme: 'tel', path: o.phone)), icon: const Icon(Icons.call), tooltip: 'Call customer'),
            ]),
            Text('${o.address}${o.pincode != null ? ' - ${o.pincode}' : ''}', style: const TextStyle(color: Brand.muted, height: 1.35)),
            if (o.notes != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Note: ${o.notes}', style: const TextStyle(fontStyle: FontStyle.italic, color: Brand.muted))),
          ])),
          const SizedBox(height: 12),
          _card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Items', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
            const SizedBox(height: 6),
            for (final i in o.items)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(children: [
                  ProductImage(url: i.image, size: 40, radius: 8),
                  const SizedBox(width: 12),
                  Expanded(child: Text(i.name, style: const TextStyle(fontWeight: FontWeight.w600))),
                  Text('× ${i.qty}', style: const TextStyle(fontWeight: FontWeight.w800)),
                ]),
              ),
          ])),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Brand.accentTint, borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              const Icon(Icons.payments_outlined, color: Brand.accent),
              const SizedBox(width: 12),
              const Expanded(child: Text('Collect cash from customer', style: TextStyle(fontWeight: FontWeight.w700))),
              Text(rupees(o.total), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: Brand.accent)),
            ]),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: Brand.line))),
          child: FilledButton(
            onPressed: _busy ? null : () => out ? _deliver(o) : _pickup(o),
            style: out ? FilledButton.styleFrom(backgroundColor: Brand.veg) : null,
            child: _busy
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                : Text(out ? 'Mark as delivered' : 'Picked up - start delivery'),
          ),
        ),
      ),
    );
  }

  Widget _card(Widget child) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(16)),
        child: child,
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
