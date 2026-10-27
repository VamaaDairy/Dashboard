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
import 'rider_order_screen.dart';
import 'rider_ui.dart';

/// The rider's day: a summary, a map of every drop, then a panel per delivery - on the way first,
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
          Text(first, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          Text(sharing ? 'Location on' : 'Location off', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: sharing ? Brand.muted : Brand.warn)),
        ]),
        actions: [
          if (!sharing) TextButton(onPressed: actions.startSharing, child: const Text('Turn on')),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: actions.refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + MediaQuery.paddingOf(context).bottom),
          children: [
            SummaryStrip([
              SummaryItem('${toPick.length}', 'To pick up'),
              SummaryItem('${out.length}', 'On the way'),
              SummaryItem(rupees(cash), 'Cash to collect'),
            ]),
            if (rider.locationProblem != null) RiderNotice(rider.locationProblem!),
            if (rider.error != null) RiderNotice(rider.error!, color: Brand.danger, onRetry: actions.refresh),
            if (pins.isNotEmpty) ...[
              const SizedBox(height: 16),
              ClipRRect(
                borderRadius: BorderRadius.circular(riderRadius),
                child: GaiaMap(
                  height: 180,
                  markers: [
                    for (final o in pins) MapMarker.home(GeoPoint(o.lat!, o.lng!), color: Brand.accent),
                    if (here != null) MapMarker.rider(here, heading: rider.heading),
                  ],
                ),
              ),
            ],
            if (orders.isEmpty)
              rider.loading
                  ? const Padding(padding: EdgeInsets.only(top: 48), child: Center(child: CircularProgressIndicator(color: Brand.accent)))
                  : const RiderEmpty('No deliveries right now', 'New orders appear here as soon as they are assigned to you. Pull down to refresh.'),
            if (out.isNotEmpty) ...[
              SectionLabel('On the way · ${out.length}'),
              for (final o in out) Padding(padding: const EdgeInsets.only(bottom: 10), child: _OrderCard(order: o, here: here)),
            ],
            if (toPick.isNotEmpty) ...[
              SectionLabel('To pick up · ${toPick.length}'),
              for (final o in toPick) Padding(padding: const EdgeInsets.only(bottom: 10), child: _OrderCard(order: o, here: here)),
            ],
          ],
        ),
      ),
    );
  }
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
    final away = awayText(widget.here, o);
    final paid = o.paymentStatus == 'paid';
    final items = o.items.take(3).map((i) => '${i.name} × ${i.qty}').join(', ');
    final more = o.items.length - 3;

    return RiderPanel(
      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => RiderOrderScreen(orderNo: o.orderNo))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Text(o.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
            if (away != null) Text(away, style: const TextStyle(fontSize: 13, color: Brand.muted)),
          ]),
          const SizedBox(height: 3),
          Text(o.address, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, color: Brand.muted, height: 1.3)),
          if (items.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(more > 0 ? '$items  +$more more' : items, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, height: 1.3)),
          ],
          const SizedBox(height: 10),
          Text(
            '${o.orderNo}  ·  ${o.itemCount} ${o.itemCount == 1 ? 'item' : 'items'}  ·  ${paid ? 'Paid' : 'Collect ${rupees(o.total)}'}',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: paid ? Brand.muted : Brand.ink),
          ),
          const SizedBox(height: 12),
          _busy
              ? const SizedBox(height: 48, child: Center(child: CircularProgressIndicator(color: Brand.accent)))
              : Row(children: [
                  if (o.phone.isNotEmpty) ...[
                    OutlinedButton(
                      onPressed: () => launchUrl(Uri(scheme: 'tel', path: o.phone)),
                      style: riderOutlined(),
                      child: const Text('Call'),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: FilledButton(
                      onPressed: () => _act(() => out ? riderDeliverFlow(context, ref, o) : riderPickupFlow(context, ref, o)),
                      style: riderFilled(),
                      child: Text(out ? 'Mark delivered' : 'Picked up'),
                    ),
                  ),
                ]),
        ],
      ),
    );
  }
}
