import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../gaia_map.dart';
import '../models.dart';
import '../store/map.dart';
import '../store/rider.dart';
import '../theme.dart';
import 'rider_history_screen.dart';
import 'rider_order_screen.dart';

/// The rider's day: where they are and every drop on one big map, a one-line summary, and
/// a card per delivery (customer, area, how far, cash to collect). Tap a card to work on it.
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
    _timer = Timer.periodic(const Duration(seconds: 20), (_) => rider.refresh());
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
    final toPick = orders.where((o) => o.status != 'out_for_delivery').length;
    final onWay = orders.length - toPick;
    final cash = orders.fold<double>(0, (s, o) => s + o.total);
    final sharing = rider.locationProblem == null;
    final first = (rider.profile?.name ?? 'rider').split(' ').first;
    final size = MediaQuery.sizeOf(context);
    final top = MediaQuery.paddingOf(context).top;

    return Scaffold(
      body: Stack(
        children: [
          // the whole screen is the map; the list slides over it
          Positioned.fill(
            child: GaiaMap(
              height: size.height,
              radius: 0,
              padding: EdgeInsets.fromLTRB(60, top + 120, 60, size.height * 0.45 + 30),
              markers: [
                for (final o in orders)
                  if (o.hasPin) MapMarker.home(GeoPoint(o.lat!, o.lng!), color: o.status == 'out_for_delivery' ? const Color(0xFFE8590C) : const Color(0xFF2E8B3D)),
                if (here != null) MapMarker.rider(here, heading: rider.heading),
              ],
            ),
          ),
          // header floating on the map
          Positioned(
            left: 12,
            right: 12,
            top: top + 8,
            child: Material(
              color: Colors.white,
              elevation: 3,
              shadowColor: Colors.black26,
              borderRadius: BorderRadius.circular(18),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 4, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Hi, $first', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 2),
                          Row(children: [
                            Container(width: 8, height: 8, decoration: BoxDecoration(color: sharing ? Brand.veg : const Color(0xFFE8590C), shape: BoxShape.circle)),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(sharing ? 'On duty · location on' : 'Location off',
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: sharing ? Brand.veg : const Color(0xFFE8590C))),
                            ),
                          ]),
                        ],
                      ),
                    ),
                    if (!sharing) TextButton(onPressed: actions.startSharing, child: const Text('Turn on')),
                    rider.loading
                        ? const Padding(padding: EdgeInsets.all(14), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Brand.accent)))
                        : IconButton(tooltip: 'Refresh', icon: const Icon(Icons.refresh), onPressed: actions.refresh),
                    IconButton(tooltip: 'Sign out', icon: const Icon(Icons.logout), onPressed: () => _signOut(actions)),
                  ],
                ),
              ),
            ),
          ),
          // the day's list: drag up for more, down to see more map
          DraggableScrollableSheet(
            initialChildSize: 0.45,
            minChildSize: 0.18,
            maxChildSize: 0.92,
            snap: true,
            snapSizes: const [0.45],
            builder: (context, scroll) => Container(
              decoration: const BoxDecoration(
                color: Brand.surface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [BoxShadow(color: Color(0x26000000), blurRadius: 16, offset: Offset(0, -4))],
              ),
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                child: CustomScrollView(
                  controller: scroll,
                  slivers: [
                    SliverToBoxAdapter(
                      child: Center(
                        child: Container(
                          margin: const EdgeInsets.only(top: 10, bottom: 12),
                          width: 44,
                          height: 5,
                          decoration: BoxDecoration(color: Brand.faint.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(3)),
                        ),
                      ),
                    ),
                    // today's numbers
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        child: Material(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(18),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            child: Row(
                              children: [
                                _stat('$toPick', 'To pick up', const Color(0xFF2E8B3D)),
                                _divider(),
                                _stat('$onWay', 'On the way', const Color(0xFFE8590C)),
                                _divider(),
                                _stat(rupees(cash), 'Cash to collect', Brand.accent),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (rider.locationProblem != null)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                          child: Text(rider.locationProblem!, style: const TextStyle(color: Color(0xFF8A5A00), fontWeight: FontWeight.w600)),
                        ),
                      ),
                    if (rider.error != null)
                      SliverToBoxAdapter(
                        child: Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 12), child: Text(rider.error!, style: const TextStyle(color: Brand.danger))),
                      ),
                    if (orders.isEmpty)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(32, 8, 32, 40),
                          child: rider.loading
                              ? const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator(color: Brand.accent)))
                              : const Column(children: [
                                  Icon(Icons.inventory_2_outlined, size: 52, color: Brand.faint),
                                  SizedBox(height: 12),
                                  Text('No deliveries right now', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                                  SizedBox(height: 4),
                                  Text('New orders show up here as soon as they are given to you.', textAlign: TextAlign.center, style: TextStyle(color: Brand.muted)),
                                ]),
                        ),
                      )
                    else ...[
                      const SliverToBoxAdapter(
                        child: Padding(
                          padding: EdgeInsets.fromLTRB(20, 0, 20, 10),
                          child: Text('Your deliveries', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                        ),
                      ),
                      SliverPadding(
                        padding: EdgeInsets.fromLTRB(16, 0, 16, 24 + MediaQuery.paddingOf(context).bottom),
                        sliver: SliverList.separated(
                          itemCount: orders.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (_, i) => _OrderCard(order: orders[i], here: here),
                        ),
                      ),
                    ],
                    // finished work, day by day
                    if (rider.history.isNotEmpty) ...[
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: EdgeInsets.fromLTRB(20, orders.isEmpty ? 0 : 8, 8, 6),
                          child: Row(children: [
                            const Expanded(child: Text('Previous deliveries', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
                            TextButton(
                              onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const RiderHistoryScreen())),
                              child: const Text('See all'),
                            ),
                          ]),
                        ),
                      ),
                      SliverPadding(
                        padding: EdgeInsets.fromLTRB(16, 0, 16, 24 + MediaQuery.paddingOf(context).bottom),
                        sliver: SliverList.separated(
                          itemCount: rider.history.length.clamp(0, 5),
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) {
                            final d = rider.history[i];
                            return DeliveryDayTile(
                              day: d,
                              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => RiderHistoryScreen(open: d.day))),
                            );
                          },
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

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

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order, required this.here});
  final Order order;
  final GeoPoint? here;

  @override
  Widget build(BuildContext context) {
    final o = order;
    final out = o.status == 'out_for_delivery';
    final tone = out ? const Color(0xFFE8590C) : const Color(0xFF2E8B3D);
    final away = awayText(here, o);
    // the first part of the address is the useful bit at a glance (house / street)
    final area = o.address.split(',').take(2).join(',').trim();

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
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(color: tone.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(out ? Icons.two_wheeler : Icons.storefront_outlined, size: 15, color: tone),
                      const SizedBox(width: 5),
                      Text(out ? 'On the way' : 'Pick up', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: tone)),
                    ]),
                  ),
                  const Spacer(),
                  if (away != null) Text(away, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Brand.muted)),
                ],
              ),
              const SizedBox(height: 12),
              Text(o.name, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
              const SizedBox(height: 3),
              Text(area.isEmpty ? o.address : area, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, color: Brand.muted, height: 1.3)),
              const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1, color: Brand.line)),
              Row(
                children: [
                  const Icon(Icons.payments_outlined, size: 20, color: Brand.accent),
                  const SizedBox(width: 8),
                  Text('Collect ${rupees(o.total)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(width: 8),
                  Text('· ${o.itemCount} ${o.itemCount == 1 ? 'item' : 'items'}', style: const TextStyle(color: Brand.muted)),
                  const Spacer(),
                  const Icon(Icons.chevron_right, color: Brand.faint),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
