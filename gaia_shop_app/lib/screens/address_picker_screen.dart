import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../models.dart';
import '../state/map_state.dart';
import '../theme.dart';

/// Choose where the order goes: search an address, use the current location, or move the map under the pin.
class AddressPickerScreen extends StatefulWidget {
  const AddressPickerScreen({super.key, this.initial});
  final PickedLocation? initial;

  @override
  State<AddressPickerScreen> createState() => _AddressPickerScreenState();
}

class _AddressPickerScreenState extends State<AddressPickerScreen> {
  static const _start = LatLng(12.9716, 77.5946); // until we know better

  final _search = TextEditingController();
  MapLibreMapController? _map;
  Timer? _debounce;
  List<PlaceSuggestion> _suggestions = [];
  PickedLocation? _picked;
  bool _resolving = false;
  bool _searching = false;
  String? _note;

  @override
  void initState() {
    super.initState();
    _picked = widget.initial;
    context.read<MapState>().load();
    if (widget.initial == null) WidgetsBinding.instance.addPostFrameCallback((_) => _useCurrent(silent: true));
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _moveTo(double lat, double lng, {double zoom = 17}) async {
    await _map?.animateCamera(CameraUpdate.newLatLngZoom(LatLng(lat, lng), zoom));
  }

  Future<void> _useCurrent({bool silent = false}) async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        if (!silent) setState(() => _note = 'Turn on the phone\'s location (GPS) to use your current location.');
        return;
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        if (!silent) setState(() => _note = 'Allow location for Gaia in the phone\'s settings, or search for your address.');
        return;
      }
      final p = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high));
      if (!mounted) return;
      setState(() => _note = null);
      await _moveTo(p.latitude, p.longitude);
      await _resolve(p.latitude, p.longitude);
    } catch (_) {
      if (!silent && mounted) setState(() => _note = 'Could not get your location. Search for your address instead.');
    }
  }

  Future<void> _resolve(double lat, double lng) async {
    setState(() => _resolving = true);
    PickedLocation? r;
    try {
      r = await context.read<Api>().reverse(lat, lng);
    } catch (_) {
      r = null;
    }
    if (!mounted) return;
    setState(() {
      _resolving = false;
      _picked = r ?? PickedLocation(lat: lat, lng: lng, address: 'Pinned location (${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)})');
    });
  }

  void _onCameraIdle() {
    final t = _map?.cameraPosition?.target;
    if (t != null) _resolve(t.latitude, t.longitude);
  }

  void _onSearch(String q) {
    _debounce?.cancel();
    if (q.trim().length < 3) {
      setState(() {
        _suggestions = [];
        _searching = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      setState(() => _searching = true);
      List<PlaceSuggestion> r = [];
      try {
        final t = _map?.cameraPosition?.target;
        r = await context.read<Api>().searchPlaces(q.trim(), near: t == null ? null : GeoPoint(t.latitude, t.longitude));
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _suggestions = r;
        _searching = false;
      });
    });
  }

  Future<void> _pick(PlaceSuggestion s) async {
    FocusScope.of(context).unfocus();
    _search.clear();
    setState(() => _suggestions = []);
    await _moveTo(s.lat, s.lng);
    setState(() => _picked = PickedLocation(lat: s.lat, lng: s.lng, address: s.address.isEmpty ? s.title : s.address));
    _resolve(s.lat, s.lng);
  }

  @override
  Widget build(BuildContext context) {
    final map = context.watch<MapState>();
    final start = widget.initial == null ? _start : LatLng(widget.initial!.lat, widget.initial!.lng);

    return Scaffold(
      appBar: AppBar(title: const Text('Delivery location')),
      body: Stack(
        children: [
          Positioned.fill(
            child: !map.enabled
                ? const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('The map is not available right now.', style: TextStyle(color: Brand.muted))))
                : MapLibreMap(
                    styleString: map.styleUrl,
                    initialCameraPosition: CameraPosition(target: start, zoom: widget.initial == null ? 12 : 17),
                    trackCameraPosition: true,
                    compassEnabled: false,
                    rotateGesturesEnabled: false,
                    tiltGesturesEnabled: false,
                    onMapCreated: (c) => _map = c,
                    onCameraIdle: _onCameraIdle,
                  ),
          ),
          // the pin stays in the middle; the map moves under it
          const IgnorePointer(child: Center(child: Padding(padding: EdgeInsets.only(bottom: 40), child: Icon(Icons.location_on, size: 48, color: Brand.accent)))),
          Positioned(
            left: 16,
            right: 16,
            top: 12,
            child: Column(
              children: [
                Material(
                  elevation: 3,
                  borderRadius: BorderRadius.circular(14),
                  child: TextField(
                    controller: _search,
                    onChanged: _onSearch,
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      hintText: 'Search area, street or landmark',
                      prefixIcon: const Icon(Icons.search, color: Brand.muted),
                      suffixIcon: _searching
                          ? const Padding(padding: EdgeInsets.all(14), child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)))
                          : null,
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                    ),
                  ),
                ),
                if (_suggestions.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(top: 6),
                    constraints: const BoxConstraints(maxHeight: 280),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: const [BoxShadow(color: Color(0x26000000), blurRadius: 10)]),
                    child: ListView.separated(
                      shrinkWrap: true,
                      padding: EdgeInsets.zero,
                      itemCount: _suggestions.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final s = _suggestions[i];
                        return ListTile(
                          dense: true,
                          leading: const Icon(Icons.place_outlined, color: Brand.muted),
                          title: Text(s.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                          subtitle: Text(s.address, maxLines: 2, overflow: TextOverflow.ellipsis),
                          onTap: () => _pick(s),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
          Positioned(
            right: 16,
            bottom: 178,
            child: FloatingActionButton.small(
              heroTag: 'locate',
              backgroundColor: Colors.white,
              foregroundColor: Brand.accent,
              onPressed: () => _useCurrent(),
              tooltip: 'Use my current location',
              child: const Icon(Icons.my_location),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Brand.line))),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_note != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_note!, style: const TextStyle(color: Brand.danger, fontSize: 13))),
              const Text('DELIVER TO', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: Brand.faint)),
              const SizedBox(height: 4),
              SizedBox(
                height: 44,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(padding: EdgeInsets.only(top: 2), child: Icon(Icons.location_on, size: 20, color: Brand.accent)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _resolving ? 'Finding address…' : (_picked?.address ?? 'Move the map to place the pin on your door'),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, height: 1.3),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _picked == null || _resolving ? null : () => Navigator.of(context).pop(_picked),
                child: const Text('Confirm location'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
