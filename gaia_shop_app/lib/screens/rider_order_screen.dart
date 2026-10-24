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

/// One delivery: the map to the customer, who they are, what to hand over, and the two steps - picked up, delivered.
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
    if (last != null &&
        (last.lat - here.lat).abs() < 0.0008 &&
        (last.lng - here.lng).abs() < 0.0008) {
      return;
    }
    _routedFrom = here;
    try {
      final r = await ref.read(apiProvider).route(here, GeoPoint(o.lat!, o.lng!));
      if (mounted) setState(() => _route = r);
    } catch (_) {
      // the dots are still on the map
    }
  }

  void _toast(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _pickup(Order o) async {
    setState(() => _busy = true);
    try {
      await ref.read(riderProvider.notifier).pickup(o);
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
    final rider = ref.read(riderProvider.notifier);
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
  Future<void> _navigate(Order o) => Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => RiderNavigationScreen(order: o)));

  @override
  Widget build(BuildContext context) {
    final rider = ref.watch(riderProvider);
    final o = _find(rider);
    if (o == null) {
      return Scaffold(appBar: AppBar(), body: const Center(child: Text('This delivery is no longer on your list.')));
    }
    final here = rider.here;
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadRoute(o, here));
    final out = o.status == 'out_for_delivery';
    final r = _route;
    final size = MediaQuery.sizeOf(context);
    final top = MediaQuery.paddingOf(context).top;

    return Scaffold(
      body: Stack(
        children: [
          // the whole screen is the map; the details slide over it
          Positioned.fill(
            child: o.hasPin
                ? GaiaMap(
                    height: size.height,
                    radius: 0,
                    padding: EdgeInsets.fromLTRB(60, top + 110, 60, size.height * 0.48 + 30),
                    route: r?.points ?? const [],
                    markers: [
                      MapMarker.home(GeoPoint(o.lat!, o.lng!), color: out ? const Color(0xFFE8590C) : const Color(0xFF2E8B3D)),
                      if (here != null) MapMarker.rider(here, heading: rider.heading),
                    ],
                  )
                : Container(
                    color: const Color(0xFFFFF4E5),
                    alignment: Alignment.topLeft,
                    padding: EdgeInsets.fromLTRB(20, top + 90, 20, 0),
                    child: const Text('No map pin for this order - use the address and call the customer.',
                        style: TextStyle(color: Color(0xFF8A5A00), fontWeight: FontWeight.w700, fontSize: 15)),
                  ),
          ),
          // back + order number
          Positioned(
            left: 12,
            top: top + 8,
            child: Material(
              color: Colors.white,
              elevation: 3,
              shadowColor: Colors.black26,
              borderRadius: BorderRadius.circular(24),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(icon: const Icon(Icons.arrow_back), tooltip: 'Back', onPressed: () => Navigator.of(context).maybePop()),
                Padding(padding: const EdgeInsets.only(right: 16), child: Text(o.orderNo, style: const TextStyle(fontWeight: FontWeight.w800))),
              ]),
            ),
          ),
          // full-screen turn-by-turn, at any step
          if (o.hasPin)
            Positioned(
              right: 12,
              top: top + 8,
              child: FilledButton.icon(
                onPressed: () => _navigate(o),
                style: FilledButton.styleFrom(minimumSize: const Size(0, 48), padding: const EdgeInsets.symmetric(horizontal: 18), elevation: 3),
                icon: const Icon(Icons.navigation, size: 20),
                label: const Text('Directions'),
              ),
            ),
          // details: drag up for everything, down to see more map
          DraggableScrollableSheet(
            initialChildSize: 0.48,
            minChildSize: 0.2,
            maxChildSize: 0.9,
            snap: true,
            snapSizes: const [0.48],
            builder: (context, scroll) => Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [BoxShadow(color: Color(0x26000000), blurRadius: 16, offset: Offset(0, -4))],
              ),
              child: ListView(
                controller: scroll,
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                children: [
                  Center(
                    child: Container(
                      margin: const EdgeInsets.only(top: 10, bottom: 14),
                      width: 44,
                      height: 5,
                      decoration: BoxDecoration(color: Brand.faint.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(3)),
                    ),
                  ),
                  // time and distance on the road
                  if (r != null && r.eta.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Row(children: [
                        const Icon(Icons.schedule, size: 20, color: Brand.veg),
                        const SizedBox(width: 6),
                        Text(r.eta, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Brand.veg)),
                        Text('  ·  ${r.distance} by road', style: const TextStyle(fontWeight: FontWeight.w700, color: Brand.muted)),
                      ]),
                    ),
                  _Steps(out: out),
                  const SizedBox(height: 20),
                  // who and where
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(o.name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            Text('${o.address}${o.pincode != null ? ' - ${o.pincode}' : ''}', style: const TextStyle(fontSize: 14.5, color: Brand.muted, height: 1.4)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      _RoundAction(icon: Icons.call, label: 'Call', color: Brand.veg, onTap: () => launchUrl(Uri(scheme: 'tel', path: o.phone))),
                    ],
                  ),
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
                  const SizedBox(height: 16),
                  // the money, big
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: Brand.accentTint, borderRadius: BorderRadius.circular(16)),
                    child: Row(children: [
                      const Icon(Icons.payments_outlined, color: Brand.accent, size: 26),
                      const SizedBox(width: 12),
                      const Expanded(child: Text('Collect in cash', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                      Text(rupees(o.total), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 24, color: Brand.accent)),
                    ]),
                  ),
                  const SizedBox(height: 20),
                  // what to hand over
                  Text('${o.itemCount} ${o.itemCount == 1 ? 'item' : 'items'} to hand over', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 6),
                  for (final i in o.items)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(children: [
                        ProductImage(url: i.image, size: 44, radius: 10, fit: BoxFit.contain, outlined: true),
                        const SizedBox(width: 12),
                        Expanded(child: Text(i.name, style: const TextStyle(fontWeight: FontWeight.w600))),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(8)),
                          child: Text('× ${i.qty}', style: const TextStyle(fontWeight: FontWeight.w900)),
                        ),
                      ]),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.paddingOf(context).bottom),
        decoration: const BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -2))]),
        child: _busy
            ? const SizedBox(height: 56, child: Center(child: CircularProgressIndicator(color: Brand.accent)))
            : !out
                ? FilledButton.icon(
                    onPressed: () => _pickup(o),
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
                    icon: const Icon(Icons.inventory_2_outlined),
                    label: const Text('Picked up · start delivery'),
                  )
                : FilledButton.icon(
                    onPressed: () => _deliver(o),
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56), backgroundColor: Brand.veg),
                    icon: const Icon(Icons.check_circle_outline),
                    label: const Text('Delivered · enter code'),
                  ),
      ),
    );
  }
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
            decoration: BoxDecoration(
                color: done
                    ? Brand.accent
                    : (now ? Brand.accentTint : Brand.surface),
                shape: BoxShape.circle,
                border: Border.all(color: c, width: now ? 2 : 1)),
            child: Icon(done ? Icons.check : icon,
                size: 18, color: done ? Colors.white : c),
          ),
          const SizedBox(height: 6),
          Text(label,
              style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: now ? FontWeight.w800 : FontWeight.w600,
                  color: now ? Brand.ink : Brand.muted)),
        ]),
      );
    }

    Widget line(int i) => Expanded(
        child: Container(
            height: 2,
            margin: const EdgeInsets.only(bottom: 22),
            color: i < at ? Brand.accent : Brand.line));

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
  const _RoundAction(
      {required this.icon,
      required this.label,
      required this.color,
      required this.onTap});
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Column(children: [
        Material(
          color: color,
          shape: const CircleBorder(),
          child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onTap,
              child: SizedBox(
                  width: 52,
                  height: 52,
                  child: Icon(icon, color: Colors.white))),
        ),
        const SizedBox(height: 4),
        Text(label,
            style: TextStyle(
                fontSize: 12, fontWeight: FontWeight.w700, color: color)),
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
      padding: EdgeInsets.fromLTRB(
          24, 0, 24, MediaQuery.viewInsetsOf(context).bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Delivery code',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(
              'Collect ${rupees(widget.amount)} in cash, then ask the customer for the 4-digit code on their order screen.',
              style: const TextStyle(color: Brand.muted, height: 1.35)),
          const SizedBox(height: 18),
          TextField(
            controller: _otp,
            autofocus: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 30, fontWeight: FontWeight.w900, letterSpacing: 10),
            decoration: const InputDecoration(counterText: ''),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _otp.text.trim().length == 4
                ? () => Navigator.pop(context, _otp.text.trim())
                : null,
            child: const Text('Confirm delivery'),
          ),
        ],
      ),
    );
  }
}
