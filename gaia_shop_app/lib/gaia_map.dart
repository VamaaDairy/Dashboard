import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'models.dart';
import 'store/map.dart';
import 'theme.dart';

/// What a marker shows: the rider on their scooter, the customer's door, or a plain dot.
enum MarkerKind { rider, home, dot }

/// Something on the map. [heading] (degrees, 0 = north) turns the rider's badge the way they ride.
class MapMarker {
  const MapMarker(this.point, this.color, {this.radius = 9, this.kind = MarkerKind.dot, this.heading});
  const MapMarker.rider(this.point, {this.heading})
      : kind = MarkerKind.rider,
        color = Brand.accent,
        radius = 0;
  const MapMarker.home(this.point, {this.color = const Color(0xFF2E8B3D)})
      : kind = MarkerKind.home,
        radius = 0,
        heading = null;

  final GeoPoint point;
  final Color color;
  final double radius;
  final MarkerKind kind;
  final double? heading;
}

String _hex(Color c) => '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

/// The Ola map with icon markers and an optional route line. Shows a quiet note instead when maps are not switched on.
class GaiaMap extends ConsumerStatefulWidget {
  const GaiaMap({super.key, required this.markers, this.route = const [], this.height = 220, this.radius = 16, this.follow, this.padding = const EdgeInsets.all(56)});

  final List<MapMarker> markers;
  final List<GeoPoint> route;
  final double height;
  final double radius;

  /// Turn-by-turn mode: keep the camera close on this point (the rider) instead of fitting everything.
  final GeoPoint? follow;

  /// Room kept clear around everything when the camera fits the markers and route
  /// (e.g. more at the bottom when a panel covers the map).
  final EdgeInsets padding;

  @override
  ConsumerState<GaiaMap> createState() => _GaiaMapState();
}

class _GaiaMapState extends ConsumerState<GaiaMap> {
  MapLibreMapController? _c;
  bool _styleReady = false;
  bool _fitted = false;
  bool _drawing = false;
  bool _again = false;
  Line? _line;
  final List<(MarkerKind, Symbol?, Circle?)> _marks = [];
  String _lastFit = '';

  @override
  void didUpdateWidget(GaiaMap old) {
    super.didUpdateWidget(old);
    _draw();
  }

  /// Our marker pictures, drawn once in Flutter and handed to the map as images.
  Future<void> _addImages(MapLibreMapController c) async {
    final dpr = MediaQuery.devicePixelRatioOf(context);
    await c.addImage('gaia-rider', await riderMarkerPng(dpr));
    await c.addImage('gaia-home', await homeMarkerPng(dpr, const Color(0xFF2E8B3D)));
  }

  /// Draws or moves things on the map. Markers are updated in place so they glide instead of blinking.
  Future<void> _draw() async {
    final c = _c;
    if (c == null || !_styleReady) return;
    if (_drawing) {
      _again = true;
      return;
    }
    _drawing = true;
    try {
      // route
      final geo = [for (final p in widget.route) LatLng(p.lat, p.lng)];
      if (geo.length > 1) {
        if (_line == null) {
          _line = await c.addLine(LineOptions(geometry: geo, lineColor: _hex(Brand.accent), lineWidth: 6, lineOpacity: 0.9, lineJoin: 'round'));
        } else {
          await c.updateLine(_line!, LineOptions(geometry: geo));
        }
      } else if (_line != null) {
        await c.removeLine(_line!);
        _line = null;
      }

      // markers: same kinds in the same order -> move them; otherwise start over
      final want = widget.markers;
      final same = want.length == _marks.length && [for (var i = 0; i < want.length; i++) want[i].kind == _marks[i].$1].every((x) => x);
      if (!same) {
        for (final m in _marks) {
          if (m.$2 != null) await c.removeSymbol(m.$2!);
          if (m.$3 != null) await c.removeCircle(m.$3!);
        }
        _marks.clear();
        for (final m in want) {
          if (m.kind == MarkerKind.dot) {
            _marks.add((m.kind, null, await c.addCircle(_circle(m))));
          } else {
            _marks.add((m.kind, await c.addSymbol(_symbol(m)), null));
          }
        }
      } else {
        for (var i = 0; i < want.length; i++) {
          final m = want[i];
          if (_marks[i].$2 != null) await c.updateSymbol(_marks[i].$2!, _symbol(m));
          if (_marks[i].$3 != null) await c.updateCircle(_marks[i].$3!, _circle(m));
        }
      }
      await _camera(c);
    } finally {
      _drawing = false;
    }
    if (_again) {
      _again = false;
      await _draw();
    }
  }

  SymbolOptions _symbol(MapMarker m) => SymbolOptions(
        geometry: LatLng(m.point.lat, m.point.lng),
        iconImage: m.kind == MarkerKind.rider ? 'gaia-rider' : 'gaia-home',
        iconSize: 1,
        // the pin's tip sits on the spot; the rider badge is centred on them
        iconAnchor: m.kind == MarkerKind.home ? 'bottom' : 'center',
        iconRotate: m.kind == MarkerKind.rider ? (m.heading ?? 0) : 0,
      );

  CircleOptions _circle(MapMarker m) => CircleOptions(
        geometry: LatLng(m.point.lat, m.point.lng),
        circleColor: _hex(m.color),
        circleRadius: m.radius,
        circleStrokeColor: '#FFFFFF',
        circleStrokeWidth: 3,
      );

  Future<void> _camera(MapLibreMapController c) async {
    final f = widget.follow;
    if (f != null) {
      await c.animateCamera(CameraUpdate.newLatLngZoom(LatLng(f.lat, f.lng), 16.5));
      return;
    }
    final pts = [...widget.markers.map((m) => m.point), ...widget.route];
    if (pts.isEmpty) return;
    var s = pts.first.lat, n = s, w = pts.first.lng, e = w;
    for (final p in pts) {
      s = math.min(s, p.lat);
      n = math.max(n, p.lat);
      w = math.min(w, p.lng);
      e = math.max(e, p.lng);
    }
    // only re-fit when what has to be in view really changed (not on every GPS tick)
    final key = [s, n, w, e].map((v) => v.toStringAsFixed(3)).join(',');
    if (_fitted && key == _lastFit) return;
    _fitted = true;
    _lastFit = key;
    if (pts.length == 1 || (n - s < 0.0005 && e - w < 0.0005)) {
      await c.animateCamera(CameraUpdate.newLatLngZoom(LatLng(pts.first.lat, pts.first.lng), 15.5));
      return;
    }
    final p = widget.padding;
    await c.animateCamera(CameraUpdate.newLatLngBounds(LatLngBounds(southwest: LatLng(s, w), northeast: LatLng(n, e)), left: p.left, top: p.top, right: p.right, bottom: p.bottom));
  }

  @override
  Widget build(BuildContext context) {
    final map = ref.watch(mapProvider);
    final first = widget.follow ?? (widget.markers.isNotEmpty ? widget.markers.first.point : const GeoPoint(21.25, 81.63));
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
                child: map.pending
                    ? const _Loading()
                    : const Text('Live map is not available right now.', textAlign: TextAlign.center, style: TextStyle(color: Brand.muted)),
              )
            : Stack(children: [
                Positioned.fill(child: MapLibreMap(
                styleString: map.styleUrl,
                initialCameraPosition: CameraPosition(target: LatLng(first.lat, first.lng), zoom: 14),
                compassEnabled: false,
                // the attribution (i) sits above whatever card rests on the map's bottom edge
                attributionButtonMargins: const math.Point(12, 72),
                rotateGesturesEnabled: false,
                tiltGesturesEnabled: false,
                onMapCreated: (c) => _c = c,
                onStyleLoadedCallback: () async {
                  final c = _c;
                  if (c == null) return;
                  await _addImages(c);
                  // the rider and the door are always drawn, even over street names
                  await c.setSymbolIconAllowOverlap(true);
                  await c.setSymbolIconIgnorePlacement(true);
                  // a new style forgets everything that was on it
                  _line = null;
                  _marks.clear();
                  _fitted = false;
                  _styleReady = true;
                  if (mounted) setState(() {});
                  await _draw();
                },
              )),
                // the native map view is black until its style arrives (slow on mobile data)
                if (!_styleReady) const Positioned.fill(child: ColoredBox(color: Brand.surface, child: Center(child: _Loading()))),
              ]),
      ),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) => const Column(mainAxisSize: MainAxisSize.min, children: [
        SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.5, color: Brand.accent)),
        SizedBox(height: 10),
        Text('Loading map…', style: TextStyle(color: Brand.muted, fontWeight: FontWeight.w600)),
      ]);
}

// ---- marker pictures ----

const _iconFont = 'MaterialIcons';

void _glyph(Canvas canvas, IconData icon, Offset centre, double size, Color color) {
  final tp = TextPainter(
    text: TextSpan(text: String.fromCharCode(icon.codePoint), style: TextStyle(fontFamily: _iconFont, fontSize: size, color: color, height: 1)),
    textDirection: TextDirection.ltr,
  )..layout();
  tp.paint(canvas, centre - Offset(tp.width / 2, tp.height / 2));
}

Future<Uint8List> _png(double w, double h, double dpr, void Function(Canvas c) paint) async {
  final rec = ui.PictureRecorder();
  final canvas = Canvas(rec)..scale(dpr);
  paint(canvas);
  final img = await rec.endRecording().toImage((w * dpr).ceil(), (h * dpr).ceil());
  final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
  return bytes!.buffer.asUint8List();
}

/// The rider: a blue disc with a scooter, a white ring, and a small arrow showing which way they face.
Future<Uint8List> riderMarkerPng(double dpr) => _png(52, 52, dpr, (c) {
      const centre = Offset(26, 28);
      c.drawCircle(centre + const Offset(0, 1.5), 18, Paint()..color = const Color(0x40000000)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3));
      c.drawCircle(centre, 18, Paint()..color = Colors.white);
      c.drawCircle(centre, 15, Paint()..color = Brand.accent);
      // heading arrow on the ring
      final arrow = Path()
        ..moveTo(26, 2)
        ..lineTo(32, 11)
        ..lineTo(20, 11)
        ..close();
      c.drawPath(arrow, Paint()..color = Brand.accent);
      c.drawPath(arrow, Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5);
      _glyph(c, Icons.two_wheeler, centre, 19, Colors.white);
    });

/// The customer's door: a map pin with a house in it; its tip marks the exact spot.
Future<Uint8List> homeMarkerPng(double dpr, Color color) => _png(44, 56, dpr, (c) {
      const r = 18.0;
      const centre = Offset(22, 21);
      // one teardrop outline: round head, sides running down into the tip
      const gap = 0.7; // half the angle (radians) the tip takes out of the bottom of the circle
      final pin = Path()
        ..arcTo(Rect.fromCircle(center: centre, radius: r), math.pi / 2 + gap, 2 * math.pi - 2 * gap, true)
        ..lineTo(22, 54)
        ..close();
      c.drawPath(pin.shift(const Offset(0, 1.5)), Paint()..color = const Color(0x40000000)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3));
      c.drawPath(pin, Paint()..color = color);
      c.drawPath(pin, Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5);
      c.drawCircle(centre, 12, Paint()..color = Colors.white);
      _glyph(c, Icons.home_rounded, centre, 17, color);
    });
