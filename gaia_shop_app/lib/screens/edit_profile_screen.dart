import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../models.dart';
import '../store/account.dart';
import '../store/map.dart';
import '../theme.dart';
import '../ui.dart';
import 'address_picker_screen.dart';

/// Everything about you in one place: name, number (fixed), and where we deliver.
/// Checkout opens this same screen to change the delivery details.
class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _address;
  late final TextEditingController _pincode;
  double? _lat;
  double? _lng;
  bool _saving = false;
  bool _pinMissing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final c = ref.read(accountProvider).customer;
    _name = TextEditingController(text: c.name);
    _address = TextEditingController(text: c.address);
    _pincode = TextEditingController(text: c.pincode);
    _lat = c.lat;
    _lng = c.lng;
    ref.read(mapProvider.notifier).load();
  }

  @override
  void dispose() {
    for (final c in [_name, _address, _pincode]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickOnMap() async {
    final picked = await Navigator.of(context).push<PickedLocation>(MaterialPageRoute(
      builder: (_) => AddressPickerScreen(initial: _lat == null || _lng == null ? null : PickedLocation(lat: _lat!, lng: _lng!, address: _address.text)),
    ));
    if (picked == null || !mounted) return;
    setState(() {
      _lat = picked.lat;
      _lng = picked.lng;
      _pinMissing = false;
      // the street address from the map is a starting point; the customer adds the flat / house number
      _address.text = picked.address;
      if (picked.pincode != null) _pincode.text = picked.pincode!;
    });
  }

  Future<void> _save() async {
    final needPin = ref.read(mapProvider).enabled && _lat == null;
    setState(() {
      _error = null;
      _pinMissing = needPin;
    });
    if (!_form.currentState!.validate() || needPin) return;
    setState(() => _saving = true);
    try {
      await ref.read(accountProvider.notifier).updateProfile(
            name: _name.text.trim().replaceAll(RegExp(r'\s+'), ' '),
            address: _address.text.trim(),
            pincode: _pincode.text.trim(),
            lat: _lat,
            lng: _lng,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile saved')));
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not save. Please try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final phone = ref.watch(accountProvider.select((a) => a.customer.phone));
    final has = _lat != null;
    final pinColor = _pinMissing ? Brand.danger : Brand.accent;
    return Scaffold(
      backgroundColor: Brand.surface,
      appBar: AppBar(title: const Text('Edit profile')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFFDECEE), borderRadius: BorderRadius.circular(14)),
                child: Row(children: [
                  const Icon(Icons.error_outline_rounded, color: Brand.danger, size: 20),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_error!, style: const TextStyle(color: Color(0xFFB3202D), fontWeight: FontWeight.w600))),
                ]),
              ),
            const _Heading('About you'),
            AppCard(
              padding: const EdgeInsets.fromLTRB(14, 16, 14, 2),
              child: Column(children: [
                _field(_name, 'Your name',
                    icon: Icons.person_outline_rounded,
                    capitalize: TextCapitalization.words,
                    autofill: const [AutofillHints.name],
                    validator: (v) => (v ?? '').trim().length < 2 ? 'Please enter your name' : null),
                // the number is the sign-in, so it is shown but not edited here
                Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: TextFormField(
                    initialValue: '+91 $phone',
                    enabled: false,
                    decoration: const InputDecoration(labelText: 'Mobile number', prefixIcon: Icon(Icons.phone_outlined, size: 20), helperText: 'This is your sign-in number'),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 18),
            const _Heading('Delivery location'),
            AppCard(
              onTap: _pickOnMap,
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                IconTile(has ? Icons.location_on_rounded : Icons.add_location_alt_outlined, color: pinColor, size: 46),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(has ? 'Pinned on the map' : 'Set your location on the map',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: _pinMissing ? Brand.danger : Brand.ink)),
                    const SizedBox(height: 2),
                    Text(
                      has ? 'The rider navigates straight to this pin' : (_pinMissing ? 'Please set your location so we can deliver to you' : 'So the rider finds your door quickly'),
                      style: TextStyle(fontSize: 12.5, color: _pinMissing ? Brand.danger : Brand.muted, height: 1.3),
                    ),
                  ]),
                ),
                const SizedBox(width: 8),
                Text(has ? 'Change' : 'Set', style: TextStyle(color: pinColor, fontWeight: FontWeight.w800)),
              ]),
            ),
            const SizedBox(height: 18),
            const _Heading('Delivery address'),
            AppCard(
              padding: const EdgeInsets.fromLTRB(14, 16, 14, 2),
              child: Column(children: [
                _field(_address, 'Full address',
                    icon: Icons.home_outlined,
                    lines: 3,
                    hint: 'House / flat no., street, landmark',
                    autofill: const [AutofillHints.fullStreetAddress],
                    validator: (v) => (v ?? '').trim().length < 10 ? 'Please enter your full delivery address' : null),
                _field(_pincode, 'Pincode (optional)',
                    icon: Icons.markunread_mailbox_outlined,
                    keyboard: TextInputType.number,
                    autofill: const [AutofillHints.postalCode],
                    validator: (v) => (v ?? '').trim().isNotEmpty && (v ?? '').trim().length != 6 ? 'Pincode must be 6 digits' : null),
              ]),
            ),
          ],
        ),
      ),
      bottomNavigationBar: StickyBar(
        child: FilledButton(
          onPressed: _saving ? null : _save,
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
          child: _saving ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Text('Save changes'),
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController c,
    String label, {
    IconData? icon,
    String? hint,
    int lines = 1,
    TextInputType? keyboard,
    TextCapitalization capitalize = TextCapitalization.none,
    Iterable<String>? autofill,
    String? Function(String?)? validator,
  }) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: TextFormField(
          controller: c,
          keyboardType: lines > 1 ? TextInputType.multiline : keyboard,
          textCapitalization: capitalize,
          minLines: lines,
          maxLines: lines,
          maxLength: lines > 1 ? 300 : null,
          autofillHints: autofill,
          textInputAction: lines > 1 ? TextInputAction.newline : TextInputAction.next,
          decoration: InputDecoration(labelText: label, hintText: hint, counterText: '', alignLabelWithHint: lines > 1, prefixIcon: icon == null ? null : Icon(icon, size: 20)),
          validator: validator,
        ),
      );
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10, left: 2),
        child: Text(text, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
      );
}
