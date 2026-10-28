import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models.dart';
import '../store/core.dart';
import '../store/map.dart';
import '../theme.dart';
import '../ui.dart';

/// Choose where the order goes: search an address, use the current location, or move the map under the pin.
class AddressPickerScreen extends ConsumerStatefulWidget {
  const AddressPickerScreen({super.key, this.initial});
  final PickedLocation? initial;

  @override
  ConsumerState<AddressPickerScreen> createState() => _AddressPickerScreenState();
}

class _AddressPickerScreenState extends ConsumerState<AddressPickerScreen> {
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
    ref.read(mapProvider.notifier).load();
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
      r = await ref.read(apiProvider).reverse(lat, lng);
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
        r = await ref.read(apiProvider).searchPlaces(q.trim(), near: t == null ? null : GeoPoint(t.latitude, t.longitude));
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
    final map = ref.watch(mapProvider);
    final start = widget.initial == null ? _start : LatLng(widget.initial!.lat, widget.initial!.lng);
    final top = MediaQuery.paddingOf(context).top;

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: !map.enabled
                ? Container(
                    color: Brand.surface,
                    alignment: Alignment.center,
                    child: map.pending
                        ? const CircularProgressIndicator()
                        : const Padding(padding: EdgeInsets.all(32), child: Text('The map is not available right now.', style: TextStyle(color: Brand.muted))),
                  )
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
          IgnorePointer(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 92),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(color: Brand.ink, borderRadius: BorderRadius.circular(12)),
                    child: const Text('Your order will be delivered here', style: TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(height: 4),
                  const Icon(Icons.location_on_rounded, size: 54, color: Brand.accent, shadows: [Shadow(color: Color(0x40000000), blurRadius: 8, offset: Offset(0, 3))]),
                  Container(width: 12, height: 5, decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(6))),
                ]),
              ),
            ),
          ),
          // back + search, floating on the map
          Positioned(
            left: 12,
            right: 12,
            top: top + 8,
            child: Column(children: [
              Row(children: [
                Material(
                  color: Colors.white,
                  shape: const CircleBorder(),
                  elevation: 3,
                  shadowColor: Colors.black26,
                  child: IconButton(icon: const Icon(Icons.arrow_back_rounded), tooltip: 'Back', onPressed: () => Navigator.of(context).maybePop()),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Material(
                    elevation: 3,
                    shadowColor: Colors.black26,
                    borderRadius: BorderRadius.circular(Brand.radius),
                    child: TextField(
                      controller: _search,
                      onChanged: _onSearch,
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        hintText: 'Search area, street or landmark',
                        prefixIcon: const Icon(Icons.search_rounded),
                        fillColor: Colors.white,
                        suffixIcon: _searching
                            ? const Padding(padding: EdgeInsets.all(14), child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)))
                            : null,
                      ),
                    ),
                  ),
                ),
              ]),
              if (_suggestions.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 8),
                  constraints: const BoxConstraints(maxHeight: 300),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Brand.radius), boxShadow: Brand.lift),
                  child: ListView.separated(
                    shrinkWrap: true,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    itemCount: _suggestions.length,
                    separatorBuilder: (_, __) => const Padding(padding: EdgeInsets.only(left: 64), child: Divider()),
                    itemBuilder: (_, i) {
                      final sg = _suggestions[i];
                      return ListTile(
                        leading: const IconTile(Icons.place_outlined, size: 38),
                        title: Text(sg.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                        subtitle: Text(sg.address, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Brand.muted, fontSize: 12.5)),
                        onTap: () => _pick(sg),
                      );
                    },
                  ),
                ),
            ]),
          ),
          Positioned(
            right: 16,
            bottom: 16,
            child: Material(
              color: Colors.white,
              elevation: 3,
              shadowColor: Colors.black26,
              borderRadius: BorderRadius.circular(24),
              child: InkWell(
                borderRadius: BorderRadius.circular(24),
                onTap: () => _useCurrent(),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.my_location_rounded, size: 18, color: Brand.accent),
                    SizedBox(width: 6),
                    Text('Current location', style: TextStyle(color: Brand.accent, fontWeight: FontWeight.w800)),
                  ]),
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(16, 18, 16, 14 + MediaQuery.paddingOf(context).bottom),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [BoxShadow(color: Color(0x1A111827), blurRadius: 18, offset: Offset(0, -4))],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Deliver to', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            if (_note != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_note!, style: const TextStyle(color: Brand.danger, fontSize: 13))),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(14)),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.location_on_rounded, size: 22, color: Brand.accent),
                const SizedBox(width: 10),
                Expanded(
                  child: SizedBox(
                    height: 40,
                    child: Text(
                      _resolving ? 'Finding the address…' : (_picked?.address ?? 'Move the map to put the pin on your door'),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, height: 1.4),
                    ),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: _picked == null || _resolving ? null : () => Navigator.of(context).pop(_picked),
              child: const Text('Confirm location'),
            ),
          ],
        ),
      ),
    );
  }
}
