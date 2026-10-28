import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../models.dart';
import '../store/distributor.dart';
import '../store/map.dart';
import '../theme.dart';
import 'address_picker_screen.dart';

/// Edit a distributor's own details. They are saved straight into the office's Customer Masters (the code, name,
/// channel, route, credit limit and the like stay with the office). The mobile number is also the sign-in number.
class DistributorEditScreen extends ConsumerStatefulWidget {
  const DistributorEditScreen({super.key, required this.firm});
  final DistFirm firm;

  @override
  ConsumerState<DistributorEditScreen> createState() => _DistributorEditScreenState();
}

class _DistributorEditScreenState extends ConsumerState<DistributorEditScreen> {
  late final Map<String, TextEditingController> _c;
  String? _state;
  double? _lat, _lng;
  bool _saving = false;
  String? _error;
  Map<String, String> _fieldErrors = {};

  @override
  void initState() {
    super.initState();
    final f = widget.firm;
    String t(String? v) => v ?? '';
    _c = {
      'contactPerson': TextEditingController(text: t(f.contactPerson)),
      'phone': TextEditingController(text: t(f.phone)),
      'email': TextEditingController(text: t(f.email)),
      'address': TextEditingController(text: t(f.address)),
      'area': TextEditingController(text: t(f.area)),
      'city': TextEditingController(text: t(f.city)),
      'pincode': TextEditingController(text: t(f.pincode)),
      'gstin': TextEditingController(text: t(f.gstin)),
      'pan': TextEditingController(text: t(f.pan)),
      'licenceNo': TextEditingController(text: t(f.licenceNo)),
    };
    _state = f.state;
    _lat = f.lat;
    _lng = f.lng;
    ref.read(mapProvider.notifier).load();
  }

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  /// Only what the person actually changed goes to the server.
  Map<String, Object?> _changes() {
    final f = widget.firm;
    final old = <String, String>{
      'contactPerson': f.contactPerson ?? '',
      'phone': f.phone ?? '',
      'email': f.email ?? '',
      'address': f.address ?? '',
      'area': f.area ?? '',
      'city': f.city ?? '',
      'pincode': f.pincode ?? '',
      'gstin': f.gstin ?? '',
      'pan': f.pan ?? '',
      'licenceNo': f.licenceNo ?? '',
    };
    final out = <String, Object?>{};
    _c.forEach((k, c) {
      if (c.text.trim() != old[k]) out[k] = c.text.trim();
    });
    if ((_state ?? '') != (f.state ?? '')) out['state'] = _state ?? '';
    if (_lat != f.lat || _lng != f.lng) {
      out['lat'] = _lat;
      out['lng'] = _lng;
    }
    return out;
  }

  Future<void> _pickOnMap() async {
    final picked = await Navigator.of(context).push<PickedLocation>(MaterialPageRoute(
      builder: (_) => AddressPickerScreen(
        initial: _lat == null ? null : PickedLocation(lat: _lat!, lng: _lng!, address: _c['address']!.text),
      ),
    ));
    if (picked == null || !mounted) return;
    setState(() {
      _lat = picked.lat;
      _lng = picked.lng;
      if (_c['address']!.text.trim().isEmpty) _c['address']!.text = picked.address;
      if (_c['pincode']!.text.trim().isEmpty && (picked.pincode ?? '').isNotEmpty) _c['pincode']!.text = picked.pincode!;
    });
  }

  Future<void> _save() async {
    final changes = _changes();
    if (changes.isEmpty) {
      Navigator.of(context).pop(false);
      return;
    }
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    setState(() {
      _saving = true;
      _error = null;
      _fieldErrors = {};
    });
    try {
      await ref.read(distributorProvider.notifier).saveFirm(widget.firm.uid, changes);
      messenger.showSnackBar(const SnackBar(content: Text('Details saved')));
      nav.pop(true);
      return;
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _fieldErrors = e.fields;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Something went wrong. Please try again.');
    }
    if (mounted) setState(() => _saving = false);
  }

  Widget _field(String key, String label, {TextInputType? type, int maxLength = 100, int lines = 1, TextCapitalization caps = TextCapitalization.none, String? helper}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: TextField(
          controller: _c[key],
          keyboardType: type,
          maxLength: maxLength,
          maxLines: lines,
          textCapitalization: caps,
          decoration: InputDecoration(labelText: label, counterText: '', helperText: helper, errorText: _fieldErrors[key]),
        ),
      );

  Widget _heading(String t) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 12),
        child: Text(t, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
      );

  @override
  Widget build(BuildContext context) {
    final states = ref.watch(distributorProvider.select((d) => d.states));
    // keep a state the office has typed in an older form selectable
    final options = {...states, if ((_state ?? '').isNotEmpty) _state!}.toList()..sort();
    return Scaffold(
      appBar: AppBar(title: const Text('Edit details')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Text(widget.firm.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          const Text('Changes are saved to Gaia\'s customer records. To change the name, route or credit limit, contact Gaia.', style: TextStyle(color: Brand.muted)),
          const SizedBox(height: 16),
          if (_error != null && _fieldErrors.isEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFFDECEE), borderRadius: BorderRadius.circular(12)),
              child: Text(_error!, style: const TextStyle(color: Color(0xFFB3202D), fontWeight: FontWeight.w600)),
            ),
          _heading('Contact'),
          _field('contactPerson', 'Contact person', caps: TextCapitalization.words),
          _field('phone', 'Mobile number', type: TextInputType.phone, maxLength: 14, helper: 'This is also the number you sign in with.'),
          _field('email', 'E-mail', type: TextInputType.emailAddress),
          _heading('Address'),
          _field('address', 'Address', lines: 3, maxLength: 300, caps: TextCapitalization.sentences),
          _field('area', 'Area', caps: TextCapitalization.words),
          _field('city', 'City', caps: TextCapitalization.words),
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: DropdownButtonFormField<String>(
              initialValue: options.contains(_state) ? _state : null,
              isExpanded: true,
              decoration: InputDecoration(labelText: 'State', errorText: _fieldErrors['state']),
              items: [for (final s in options) DropdownMenuItem(value: s, child: Text(s, overflow: TextOverflow.ellipsis))],
              onChanged: (v) => setState(() => _state = v),
            ),
          ),
          _field('pincode', 'Pincode', type: TextInputType.number, maxLength: 6),
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: OutlinedButton.icon(
              onPressed: _pickOnMap,
              icon: const Icon(Icons.place_outlined),
              label: Text(_lat == null ? 'Set location on map' : 'Change location on map'),
            ),
          ),
          if (_fieldErrors['lat'] != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(_fieldErrors['lat']!, style: const TextStyle(color: Brand.danger))),
          _heading('Tax'),
          _field('gstin', 'GSTIN', maxLength: 15, caps: TextCapitalization.characters),
          _field('pan', 'PAN', maxLength: 10, caps: TextCapitalization.characters),
          _field('licenceNo', 'Licence number'),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Text('Save'),
          ),
        ],
      ),
    );
  }
}
