import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../gaia_map.dart';
import '../models.dart';
import '../state/map_state.dart';
import '../state/rider_state.dart';
import '../theme.dart';
import 'rider_order_screen.dart';

/// What a signed-in delivery partner sees: the orders given to them. Their location is shared while this is open.
class RiderHomeScreen extends StatefulWidget {
  const RiderHomeScreen({super.key});

  @override
  State<RiderHomeScreen> createState() => _RiderHomeScreenState();
}

class _RiderHomeScreenState extends State<RiderHomeScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    final rider = context.read<RiderState>();
    // after the first frame: right after sign-in this screen is built inside the rebuild that
    // login() triggered, and loading notifies listeners - doing that mid-build lost the update
    // in release builds and left the spinner up forever
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<MapState>().load();
      rider.refresh();
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

  @override
  Widget build(BuildContext context) {
    final rider = context.watch<RiderState>();
    final orders = rider.orders;

    return Scaffold(
      appBar: AppBar(
        title: Text('Hi, ${rider.profile?.name.split(' ').first ?? 'rider'}', style: const TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () async {
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
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: Brand.accent,
        onRefresh: rider.refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            _status(rider),
            const SizedBox(height: 14),
            // everything on today's round at a glance: you (blue) and each drop (green = still to pick up, orange = on the way)
            GaiaMap(
              height: 300,
              markers: [
                for (final o in orders)
                  if (o.hasPin) MapMarker(GeoPoint(o.lat!, o.lng!), o.status == 'out_for_delivery' ? const Color(0xFFF08C00) : Brand.gaiaGreen, radius: 10),
                if (rider.here != null) MapMarker(rider.here!, Brand.accent, radius: 11),
              ],
            ),
            const SizedBox(height: 14),
            if (rider.error != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(rider.error!, style: const TextStyle(color: Brand.danger))),
            if (orders.isEmpty && !rider.loading)
              const Padding(
                padding: EdgeInsets.only(top: 80),
                child: Column(children: [
                  Icon(Icons.two_wheeler, size: 56, color: Brand.faint),
                  SizedBox(height: 12),
                  Text('No deliveries right now', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
                  SizedBox(height: 4),
                  Text('New orders appear here as soon as they are given to you.', textAlign: TextAlign.center, style: TextStyle(color: Brand.muted)),
                ]),
              ),
            if (orders.isEmpty && rider.loading) const Padding(padding: EdgeInsets.only(top: 80), child: Center(child: CircularProgressIndicator(color: Brand.accent))),
            for (final o in orders) _OrderCard(order: o),
          ],
        ),
      ),
    );
  }

  Widget _status(RiderState rider) {
    final sharing = rider.locationProblem == null;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: sharing ? const Color(0xFFE8F5EA) : const Color(0xFFFFF4E5), borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: [
          Icon(sharing ? Icons.my_location : Icons.location_off, size: 20, color: sharing ? Brand.veg : const Color(0xFF8A5A00)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              sharing ? 'Sharing your location with customers while you deliver' : rider.locationProblem!,
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: sharing ? Brand.veg : const Color(0xFF8A5A00)),
            ),
          ),
          if (!sharing) TextButton(onPressed: rider.startSharing, child: const Text('Retry')),
        ],
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});
  final Order order;

  @override
  Widget build(BuildContext context) {
    final o = order;
    final out = o.status == 'out_for_delivery';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => RiderOrderScreen(orderNo: o.orderNo))),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(16)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(o.orderNo, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: out ? const Color(0xFFE8F5EA) : Brand.accentTint, borderRadius: BorderRadius.circular(20)),
                    child: Text(out ? 'On the way' : 'Ready to pick up', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: out ? Brand.veg : Brand.accent)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(o.name, style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(o.address, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Brand.muted, height: 1.3)),
              const SizedBox(height: 10),
              Row(
                children: [
                  Text('${o.itemCount} ${o.itemCount == 1 ? 'item' : 'items'}', style: const TextStyle(color: Brand.muted, fontSize: 13)),
                  const Spacer(),
                  Text('Collect ${rupees(o.total)}', style: const TextStyle(fontWeight: FontWeight.w800)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
