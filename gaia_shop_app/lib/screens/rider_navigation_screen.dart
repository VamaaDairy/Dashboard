import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../gaia_map.dart';
import '../models.dart';
import '../state/rider_state.dart';
import '../theme.dart';

/// Turn-by-turn to the customer on Ola Maps, inside the app: full-screen map that follows the rider,
/// the next turn on top, time and distance left at the bottom. The route is asked again as the rider moves.
class RiderNavigationScreen extends StatefulWidget {
  const RiderNavigationScreen({super.key, required this.order});
  final Order order;

  @override
  State<RiderNavigationScreen> createState() => _RiderNavigationScreenState();
}

class _RiderNavigationScreenState extends State<RiderNavigationScreen> {
  RoutePath? _route;
  GeoPoint? _routedFrom;
  DateTime _routedAt = DateTime.fromMillisecondsSinceEpoch(0);
  bool _follow = true;
  bool _asking = false;
  String? _problem;
  Timer? _timer;

  GeoPoint get _dest => GeoPoint(widget.order.lat!, widget.order.lng!);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<RiderState>().startSharing();
      _reroute(force: true);
    });
    // even standing still, refresh now and then so the time left stays honest
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _reroute(force: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Asks Ola for the route from where the rider is now; skipped until they have moved ~40 m.
  Future<void> _reroute({bool force = false}) async {
    final here = context.read<RiderState>().here;
    if (here == null || _asking) return;
    final last = _routedFrom;
    final moved = last == null || (last.lat - here.lat).abs() > 0.0004 || (last.lng - here.lng).abs() > 0.0004;
    if (!moved && !(force && DateTime.now().difference(_routedAt).inSeconds >= 25)) return;
    _asking = true;
    try {
      final r = await context.read<Api>().route(here, _dest);
      _routedFrom = here;
      _routedAt = DateTime.now();
      if (mounted) {
        setState(() {
          _route = r;
          _problem = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _problem = e.message);
    } catch (_) {
      if (mounted) setState(() => _problem = 'Could not get directions. Check your internet connection.');
    }
    _asking = false;
  }

  @override
  Widget build(BuildContext context) {
    final rider = context.watch<RiderState>();
    final here = rider.here;
    // a new GPS fix may need a fresh route
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _reroute();
    });
    final r = _route;
    final next = r != null && r.steps.isNotEmpty ? r.steps.first : null;
    final then = r != null && r.steps.length > 1 ? r.steps[1] : null;
    final size = MediaQuery.sizeOf(context);
    final pad = MediaQuery.paddingOf(context);

    return Scaffold(
      body: Stack(
        children: [
          GaiaMap(
            height: size.height,
            radius: 0,
            route: r?.points ?? const [],
            follow: _follow ? here : null,
            padding: EdgeInsets.fromLTRB(60, pad.top + 200, 60, pad.bottom + 140),
            markers: [
              MapMarker.home(_dest, color: const Color(0xFFE8590C)),
              if (here != null) MapMarker.rider(here, heading: rider.heading),
            ],
          ),
          // next turn
          Positioned(
            left: 12,
            right: 12,
            top: pad.top + 10,
            child: Material(
              color: Brand.accent,
              borderRadius: BorderRadius.circular(18),
              elevation: 6,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                child: here == null
                    ? const Text('Waiting for your location (GPS)…', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700))
                    : next == null
                        ? Text(_problem ?? 'Finding the best route…', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700))
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(maneuverIcon(next.maneuver), color: Colors.white, size: 38),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(next.distance, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
                                        Text(next.text, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 15, height: 1.3, fontWeight: FontWeight.w600)),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              if (then != null) ...[
                                const SizedBox(height: 8),
                                Row(children: [
                                  const Text('Then  ', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
                                  Icon(maneuverIcon(then.maneuver), color: Colors.white70, size: 18),
                                  const SizedBox(width: 6),
                                  Expanded(child: Text(then.text, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white70))),
                                ]),
                              ],
                            ],
                          ),
              ),
            ),
          ),
          // recentre / overview
          Positioned(
            right: 14,
            bottom: pad.bottom + 150,
            child: FloatingActionButton.small(
              heroTag: 'nav-follow',
              backgroundColor: Colors.white,
              foregroundColor: Brand.accent,
              tooltip: _follow ? 'Show whole route' : 'Follow me',
              onPressed: () => setState(() => _follow = !_follow),
              child: Icon(_follow ? Icons.zoom_out_map : Icons.my_location),
            ),
          ),
          // time and distance left
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + pad.bottom),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
                boxShadow: [BoxShadow(color: Color(0x22000000), blurRadius: 16, offset: Offset(0, -4))],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(r?.eta.isNotEmpty == true ? r!.eta : '--', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Brand.veg)),
                        Text(
                          [if (r?.distance.isNotEmpty == true) r!.distance, widget.order.name].join(' · '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Brand.muted, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  IconButton.filled(
                    onPressed: () => launchUrl(Uri(scheme: 'tel', path: widget.order.phone)),
                    style: IconButton.styleFrom(backgroundColor: Brand.veg, minimumSize: const Size(52, 52)),
                    icon: const Icon(Icons.call, color: Colors.white),
                    tooltip: 'Call customer',
                  ),
                  const SizedBox(width: 10),
                  FilledButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: FilledButton.styleFrom(minimumSize: const Size(100, 52), backgroundColor: Brand.danger),
                    child: const Text('Exit'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The arrow for an Ola routing manoeuvre ("turn-left", "roundabout-right", ...).
IconData maneuverIcon(String m) {
  if (m.contains('u-turn') || m.contains('uturn')) return Icons.u_turn_left;
  if (m.contains('roundabout') || m.contains('rotary')) return Icons.roundabout_right;
  if (m.contains('slight-left') || m.contains('slight_left')) return Icons.turn_slight_left;
  if (m.contains('slight-right') || m.contains('slight_right')) return Icons.turn_slight_right;
  if (m.contains('sharp-left') || m.contains('sharp_left')) return Icons.turn_sharp_left;
  if (m.contains('sharp-right') || m.contains('sharp_right')) return Icons.turn_sharp_right;
  if (m.contains('left')) return Icons.turn_left;
  if (m.contains('right')) return Icons.turn_right;
  if (m.contains('arrive') || m.contains('destination')) return Icons.flag;
  return Icons.straight;
}
