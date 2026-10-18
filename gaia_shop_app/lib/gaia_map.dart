import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import 'package:provider/provider.dart';

import 'models.dart';
import 'state/map_state.dart';
import 'theme.dart';

/// A dot on the map (customer's door, rider, ...).
class MapMarker {
  const MapMarker(this.point, this.color, {this.radius = 9});
  final GeoPoint point;
  final Color color;
  final double radius;
}

String _hex(Color c) => '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

/// The Ola map with dots and an optional route line. Shows a quiet note instead when maps are not switched on.
class GaiaMap extends StatefulWidget {
  const GaiaMap({super.key, required this.markers, this.route = const [], this.height = 220, this.radius = 16, this.follow});

  final List<MapMarker> markers;
  final List<GeoPoint> route;
  final double height;
  final double radius;

  /// Turn-by-turn mode: keep the camera close on this point (the rider) instead of fitting everything.
  final GeoPoint? follow;

  @override
  State<GaiaMap> createState() => _GaiaMapState();
}

class _GaiaMapState extends State<GaiaMap> {
  MapLibreMapController? _c;
  bool _styleReady = false;
  bool _fitted = false;

  @override
  void didUpdateWidget(GaiaMap old) {
    super.didUpdateWidget(old);
    _draw();
  }

  Future<void> _draw() async {
    final c = _c;
    if (c == null || !_styleReady) return;
    await c.clearLines();
    await c.clearCircles();
    if (widget.route.length > 1) {
      await c.addLine(LineOptions(
        geometry: [for (final p in widget.route) LatLng(p.lat, p.lng)],
        lineColor: _hex(Brand.accent),
        lineWidth: 5,
        lineOpacity: 0.85,
      ));
    }
    for (final m in widget.markers) {
      await c.addCircle(CircleOptions(
        geometry: LatLng(m.point.lat, m.point.lng),
        circleColor: _hex(m.color),
        circleRadius: m.radius,
        circleStrokeColor: '#FFFFFF',
        circleStrokeWidth: 3,
      ));
    }
    final f = widget.follow;
    if (f != null) {
      await c.animateCamera(CameraUpdate.newLatLngZoom(LatLng(f.lat, f.lng), 16.5));
      return;
    }
    if (!_fitted || widget.markers.length > 1) {
      final pts = [...widget.markers.map((m) => m.point), ...widget.route];
      if (pts.isEmpty) return;
      _fitted = true;
      if (pts.length == 1) {
        await c.moveCamera(CameraUpdate.newLatLngZoom(LatLng(pts.first.lat, pts.first.lng), 15));
        return;
      }
      var s = pts.first.lat, n = s, w = pts.first.lng, e = w;
      for (final p in pts) {
        if (p.lat < s) s = p.lat;
        if (p.lat > n) n = p.lat;
        if (p.lng < w) w = p.lng;
        if (p.lng > e) e = p.lng;
      }
      await c.animateCamera(CameraUpdate.newLatLngBounds(LatLngBounds(southwest: LatLng(s, w), northeast: LatLng(n, e)), left: 48, top: 48, right: 48, bottom: 48));
    }
  }

  @override
  Widget build(BuildContext context) {
    final map = context.watch<MapState>();
    final first = widget.markers.isNotEmpty ? widget.markers.first.point : const GeoPoint(12.97, 77.59);
    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.radius),
      child: SizedBox(
        height: widget.height,
        width: double.infinity,
        child: !map.enabled
            ? Container(
                color: Brand.surface,
                alignment: Alignment.center,
                padding: const EdgeInsets.all(16),
                child: const Text('Live map is not available right now.', textAlign: TextAlign.center, style: TextStyle(color: Brand.muted)),
              )
            : MapLibreMap(
                styleString: map.styleUrl,
                initialCameraPosition: CameraPosition(target: LatLng(first.lat, first.lng), zoom: 14),
                compassEnabled: false,
                rotateGesturesEnabled: false,
                tiltGesturesEnabled: false,
                onMapCreated: (c) => _c = c,
                onStyleLoadedCallback: () {
                  _styleReady = true;
                  _draw();
                },
              ),
      ),
    );
  }
}
