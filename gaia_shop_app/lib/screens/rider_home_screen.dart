import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../gaia_map.dart';
import '../models.dart';
import '../store/map.dart';
import '../store/rider.dart';
import '../theme.dart';
import 'rider_history_screen.dart';
import 'rider_order_screen.dart';

const _orange = Color(0xFFE8590C);

/// The rider's day: a summary, a map of every drop, then a card per delivery - out for delivery first,
/// then those still to pick up - each with its address, items and the next step right on it.
class RiderHomeScreen extends ConsumerStatefulWidget {
  const RiderHomeScreen({super.key});

  @override
  ConsumerState<RiderHomeScreen> createState() => _RiderHomeScreenState();
}

class _RiderHomeScreenState extends ConsumerState<RiderHomeScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    final rider = ref.read(riderProvider.notifier);
    // after the first frame: right after sign-in this screen is built inside the rebuild that
    // login() triggered, and loading notifies listeners - doing that mid-build lost the update
    // in release builds and left the spinner up forever
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(mapProvider.notifier).load();
      rider.refresh();
      rider.loadHistory();
      rider.startSharing();
    });
    // new assignments show up without pulling down
    _timer = Timer.periodic(const Duration(seconds: 20), (_) => rider.refresh(quiet: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _signOut(RiderStore rider) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You will stop sharing your location and receiving deliveries on this phone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Sign out')),
        ],
      ),
    );
    if (ok == true) await rider.logout();
  }

  @override
  Widget build(BuildContext context) {
    final rider = ref.watch(riderProvider);
    final actions = ref.read(riderProvider.notifier);
    final orders = rider.orders;
    final here = rider.here;
    final out = orders.where((o) => o.status == 'out_for_delivery').toList();
    final toPick = orders.where((o) => o.status != 'out_for_delivery').toList();
    final cash = orders.where((o) => o.paymentStatus != 'paid').fold<double>(0, (s, o) => s + o.total);
    final sharing = rider.locationProblem == null;
    final first = (rider.profile?.name ?? 'rider').split(' ').first;
    final pins = orders.where((o) => o.hasPin).toList();

    return Scaffold(
      backgroundColor: Brand.surface,
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Hi, $first', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
          Row(children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: sharing ? Brand.veg : _orange, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(sharing ? 'On duty · location on' : 'Location off', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: sharing ? Brand.veg : _orange)),
          ]),
        ]),
        actions: [
          if (!sharing) TextButton(onPressed: actions.startSharing, child: const Text('Turn on')),
          IconButton(tooltip: 'Previous deliveries', icon: const Icon(Icons.history), onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const RiderHistoryScreen()))),
          IconButton(tooltip: 'Sign out', icon: const Icon(Icons.logout), onPressed: () => _signOut(actions)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: actions.refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(16, 12, 16, 24 + MediaQuery.paddingOf(context).bottom),
          children: [
            Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Row(children: [
                  _stat('${toPick.length}', 'To pick up', Brand.veg),
                  _divider(),
                  _stat('${out.length}', 'Out for delivery', _orange),
                  _divider(),
                  _stat(rupees(cash), 'Cash to collect', Brand.accent),
                ]),
              ),
            ),
            if (rider.locationProblem != null) _note(rider.locationProblem!, const Color(0xFF8A5A00)),
            if (rider.error != null) _note(rider.error!, Brand.danger, retry: actions.refresh),
            if (pins.isNotEmpty) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: GaiaMap(
                  height: 200,
                  markers: [
                    for (final o in pins) MapMarker.home(GeoPoint(o.lat!, o.lng!), color: o.status == 'out_for_delivery' ? _orange : Brand.veg),
                    if (here != null) MapMarker.rider(here, heading: rider.heading),
                  ],
                ),
              ),
            ],
            if (orders.isEmpty) ...[
              const SizedBox(height: 32),
              if (rider.loading)
                const Center(child: CircularProgressIndicator(color: Brand.accent))
              else
                const Column(children: [
                  Icon(Icons.inventory_2_outlined, size: 52, color: Brand.faint),
                  SizedBox(height: 12),
                  Text('No deliveries right now', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                  SizedBox(height: 4),
                  Text('New orders show up here as soon as they are given to you. Pull down to refresh.', textAlign: TextAlign.center, style: TextStyle(color: Brand.muted)),
                ]),
            ],
            if (out.isNotEmpty) ...[
              _heading('Out for delivery', out.length),
              for (final o in out) Padding(padding: const EdgeInsets.only(bottom: 12), child: _OrderCard(order: o, here: here)),
            ],
            if (toPick.isNotEmpty) ...[
              _heading('To pick up', toPick.length),
              for (final o in toPick) Padding(padding: const EdgeInsets.only(bottom: 12), child: _OrderCard(order: o, here: here)),
            ],
            if (rider.history.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.only(top: 12, bottom: 6),
                child: Row(children: [
                  const Expanded(child: Text('Previous deliveries', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
                  TextButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const RiderHistoryScreen())), child: const Text('See all')),
                ]),
              ),
              for (final d in rider.history.take(5))
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: DeliveryDayTile(day: d, onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => RiderHistoryScreen(open: d.day)))),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _heading(String t, int n) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 20, 4, 10),
        child: Text('$t ($n)', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
      );

  Widget _note(String text, Color color, {VoidCallback? retry}) => Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Row(children: [
          Expanded(child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w600))),
          if (retry != null) TextButton(onPressed: retry, child: const Text('Retry')),
        ]),
      );

  Widget _stat(String value, String label, Color color) => Expanded(
        child: Column(children: [
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: color)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w600)),
        ]),
      );

  Widget _divider() => Container(width: 1, height: 34, color: Brand.line);
}

/// Straight-line distance, good enough to say "2.4 km away" on a card.
String? awayText(GeoPoint? from, Order o) {
  if (from == null || !o.hasPin) return null;
  const r = 6371000.0;
  double rad(double d) => d * math.pi / 180;
  final dLat = rad(o.lat! - from.lat), dLng = rad(o.lng! - from.lng);
  final a = math.pow(math.sin(dLat / 2), 2) + math.cos(rad(from.lat)) * math.cos(rad(o.lat!)) * math.pow(math.sin(dLng / 2), 2);
  final m = 2 * r * math.asin(math.sqrt(a));
  return m < 1000 ? '${m.round()} m away' : '${(m / 1000).toStringAsFixed(1)} km away';
}

/// One delivery: who, where, what is in it and what to collect - with the next step one tap away.
class _OrderCard extends ConsumerStatefulWidget {
  const _OrderCard({required this.order, required this.here});
  final Order order;
  final GeoPoint? here;

  @override
  ConsumerState<_OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends ConsumerState<_OrderCard> {
  bool _busy = false;

  Future<void> _act(Future<bool> Function() action) async {
    setState(() => _busy = true);
    await action();
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.order;
    final out = o.status == 'out_for_delivery';
    final tone = out ? _orange : Brand.veg;
    final away = awayText(widget.here, o);
    final paid = o.paymentStatus == 'paid';
    final shown = o.items.take(3).toList();
    final more = o.items.length - shown.length;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => RiderOrderScreen(orderNo: o.orderNo))),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: tone.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(out ? Icons.two_wheeler : Icons.storefront_outlined, size: 15, color: tone),
                    const SizedBox(width: 5),
                    Text(out ? 'Out for delivery' : 'Pick up', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: tone)),
                  ]),
                ),
                const SizedBox(width: 8),
                Text(o.orderNo, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Brand.muted)),
                const Spacer(),
                if (away != null) Text(away, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Brand.muted)),
              ]),
              const SizedBox(height: 12),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(o.name, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 3),
                    Text(o.address, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, color: Brand.muted, height: 1.3)),
                  ]),
                ),
                if (o.phone.isNotEmpty)
                  IconButton.filled(
                    tooltip: 'Call ${o.name}',
                    style: IconButton.styleFrom(backgroundColor: Brand.veg),
                    icon: const Icon(Icons.call, size: 20),
                    onPressed: () => launchUrl(Uri(scheme: 'tel', path: o.phone)),
                  ),
              ]),
              if (shown.isNotEmpty) ...[
                const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1, color: Brand.line)),
                for (final i in shown)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(children: [
                      Expanded(child: Text(i.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600))),
                      Text('× ${i.qty}', style: const TextStyle(fontWeight: FontWeight.w900)),
                    ]),
                  ),
                if (more > 0) Text('+ $more more', style: const TextStyle(color: Brand.muted, fontWeight: FontWeight.w600)),
              ],
              const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1, color: Brand.line)),
              Row(children: [
                Icon(paid ? Icons.verified_outlined : Icons.payments_outlined, size: 20, color: paid ? Brand.veg : Brand.accent),
                const SizedBox(width: 8),
                Text(paid ? 'Paid' : 'Collect ${rupees(o.total)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(width: 8),
                Text('· ${o.itemCount} ${o.itemCount == 1 ? 'item' : 'items'}', style: const TextStyle(color: Brand.muted)),
                const Spacer(),
                const Icon(Icons.chevron_right, color: Brand.faint),
              ]),
              const SizedBox(height: 12),
              _busy
                  ? const SizedBox(height: 48, child: Center(child: CircularProgressIndicator(color: Brand.accent)))
                  : out
                      ? FilledButton.icon(
                          onPressed: () => _act(() => riderDeliverFlow(context, ref, o)),
                          style: FilledButton.styleFrom(backgroundColor: Brand.veg, minimumSize: const Size.fromHeight(48)),
                          icon: const Icon(Icons.check_circle_outline),
                          label: const Text('Delivered · enter code'),
                        )
                      : FilledButton.icon(
                          onPressed: () => _act(() => riderPickupFlow(context, ref, o)),
                          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                          icon: const Icon(Icons.inventory_2_outlined),
                          label: const Text('Picked up · start delivery'),
                        ),
            ],
          ),
        ),
      ),
    );
  }
}
