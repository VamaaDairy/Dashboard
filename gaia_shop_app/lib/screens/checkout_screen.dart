import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../models.dart';
import '../store/account.dart';
import '../store/cart.dart';
import '../store/map.dart';
import '../theme.dart';
import '../ui.dart';
import '../widgets.dart';
import 'address_picker_screen.dart';
import 'customer_login_screen.dart';
import 'order_screen.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final TextEditingController _address;
  late final TextEditingController _pincode;
  final _notes = TextEditingController();

  bool _placing = false;
  double? _lat;
  double? _lng;
  bool _pinMissing = false;
  String? _error;
  Map<String, String> _serverFields = {};

  @override
  void initState() {
    super.initState();
    final c = ref.read(accountProvider).customer; // remembered from the last order
    _name = TextEditingController(text: c.name);
    _phone = TextEditingController(text: c.phone);
    _address = TextEditingController(text: c.address);
    _pincode = TextEditingController(text: c.pincode);
    _lat = c.lat;
    _lng = c.lng;
    ref.read(mapProvider.notifier).load();
  }

  Future<void> _pickOnMap() async {
    final picked = await Navigator.of(context).push<PickedLocation>(MaterialPageRoute(
      builder: (_) => AddressPickerScreen(initial: _lat == null ? null : PickedLocation(lat: _lat!, lng: _lng!, address: _address.text)),
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

  @override
  void dispose() {
    for (final c in [_name, _phone, _address, _pincode, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _server(String field) => _serverFields[field];

  Future<void> _place() async {
    setState(() {
      _error = null;
      _serverFields = {};
    });
    final needPin = ref.read(mapProvider).enabled && _lat == null;
    setState(() => _pinMissing = needPin);
    if (!_form.currentState!.validate() || needPin) return;

    final cart = ref.read(cartProvider.notifier);
    final lines = ref.read(cartProvider).lines;
    final orders = ref.read(accountProvider.notifier);
    final nav = Navigator.of(context);
    setState(() => _placing = true);
    try {
      final order = await orders.place(
        who: Customer(name: _name.text.trim(), phone: _phone.text.trim(), address: _address.text.trim(), pincode: _pincode.text.trim(), lat: _lat, lng: _lng),
        notes: _notes.text,
        lines: lines,
      );
      cart.clear();
      // back to the menu, with the order on top
      nav.pushAndRemoveUntil(MaterialPageRoute<void>(builder: (_) => OrderScreen(order: order, justPlaced: true)), (r) => r.isFirst);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _placing = false;
        _error = e.message;
        _serverFields = e.fields;
      });
      _form.currentState?.validate();
      // signed out meanwhile (e.g. signed in on another phone): sign in again, then try once more
      if (e.message.contains('sign in') && await CustomerLoginScreen.ensure(context, reason: 'Please sign in again to place your order.') && mounted) {
        setState(() => _error = null);
        await _place();
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _placing = false;
        _error = 'Something went wrong. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = ref.watch(cartProvider.select((c) => c.total));
    final count = ref.watch(cartProvider.select((c) => c.count));

    return Scaffold(
      backgroundColor: Brand.surface,
      appBar: AppBar(title: const Text('Checkout')),
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
            const _Step('1', 'Deliver to'),
            _locationCard(),
            const SizedBox(height: 18),
            const _Step('2', 'Contact & address'),
            AppCard(
              padding: const EdgeInsets.fromLTRB(14, 16, 14, 2),
              child: Column(children: [
                _field(_name, 'Your name', 'name', icon: Icons.person_outline_rounded, autofill: const [AutofillHints.name], validator: (v) => (v ?? '').trim().length < 2 ? 'Please enter your name' : null),
                _field(_phone, 'Mobile number', 'phone',
                    icon: Icons.phone_outlined,
                    keyboard: TextInputType.phone,
                    autofill: const [AutofillHints.telephoneNumber],
                    hint: '10-digit number',
                    validator: (v) {
                      final d = (v ?? '').replaceAll(RegExp(r'\D'), '');
                      final ten = d.length > 10 ? d.substring(d.length - 10) : d;
                      return RegExp(r'^[6-9]\d{9}$').hasMatch(ten) ? null : 'Enter a valid 10-digit mobile number';
                    }),
                _field(_address, 'Full address', 'address',
                    lines: 3,
                    hint: 'House / flat no., street, landmark',
                    autofill: const [AutofillHints.fullStreetAddress],
                    validator: (v) => (v ?? '').trim().length < 10 ? 'Please enter your full delivery address' : null),
                _field(_pincode, 'Pincode (optional)', 'pincode',
                    icon: Icons.markunread_mailbox_outlined,
                    keyboard: TextInputType.number,
                    autofill: const [AutofillHints.postalCode],
                    validator: (v) => (v ?? '').trim().isNotEmpty && (v ?? '').trim().length != 6 ? 'Pincode must be 6 digits' : null),
                _field(_notes, 'Delivery note (optional)', 'notes', icon: Icons.sticky_note_2_outlined, hint: 'e.g. ring the bell, call before delivery'),
              ]),
            ),
            const SizedBox(height: 18),
            const _Step('3', 'Payment'),
            AppCard(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                const IconTile(Icons.payments_outlined, color: Brand.veg),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Cash on delivery', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    Text('Pay when your order arrives', style: TextStyle(fontSize: 12.5, color: Brand.muted)),
                  ]),
                ),
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Brand.accent, width: 2)),
                  child: Center(child: Container(width: 12, height: 12, decoration: const BoxDecoration(color: Brand.accent, shape: BoxShape.circle))),
                ),
              ]),
            ),
            const SizedBox(height: 18),
            const BillDetails(),
          ],
        ),
      ),
      bottomNavigationBar: StickyBar(
        child: Row(children: [
          Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(rupees(total), style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
            Text('$count ${count == 1 ? 'item' : 'items'} · cash', style: const TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(width: 16),
          Expanded(
            child: FilledButton(
              onPressed: _placing ? null : _place,
              style: FilledButton.styleFrom(backgroundColor: Brand.veg),
              child: _placing
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                  : const Text('Place order'),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _locationCard() {
    final has = _lat != null;
    final c = _pinMissing ? Brand.danger : Brand.accent;
    return AppCard(
      onTap: _pickOnMap,
      padding: const EdgeInsets.all(14),
      child: Row(children: [
        IconTile(has ? Icons.location_on_rounded : Icons.add_location_alt_outlined, color: c, size: 46),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(has ? 'Pinned on the map' : 'Set your location on the map', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: _pinMissing ? Brand.danger : Brand.ink)),
            const SizedBox(height: 2),
            Text(
              has
                  ? (_address.text.trim().isEmpty ? 'The rider navigates straight to this pin' : _address.text.trim())
                  : (_pinMissing ? 'Please set your location so we can deliver to you' : 'So the rider finds your door quickly'),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12.5, color: _pinMissing ? Brand.danger : Brand.muted, height: 1.3),
            ),
          ]),
        ),
        const SizedBox(width: 8),
        Text(has ? 'Change' : 'Set', style: TextStyle(color: c, fontWeight: FontWeight.w800)),
      ]),
    );
  }

  Widget _field(
    TextEditingController c,
    String label,
    String key, {
    IconData? icon,
    String? hint,
    int lines = 1,
    TextInputType? keyboard,
    Iterable<String>? autofill,
    String? Function(String?)? validator,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: c,
        keyboardType: lines > 1 ? TextInputType.multiline : keyboard,
        minLines: lines,
        maxLines: lines,
        autofillHints: autofill,
        textInputAction: lines > 1 ? TextInputAction.newline : TextInputAction.next,
        decoration: InputDecoration(labelText: label, hintText: hint, alignLabelWithHint: lines > 1, prefixIcon: icon == null ? null : Icon(icon, size: 20)),
        validator: (v) => validator?.call(v) ?? _server(key),
      ),
    );
  }
}

/// A numbered section heading: (1) Deliver to.
class _Step extends StatelessWidget {
  const _Step(this.n, this.title);
  final String n;
  final String title;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10, left: 2),
        child: Row(children: [
          Container(
            width: 22,
            height: 22,
            alignment: Alignment.center,
            decoration: const BoxDecoration(color: Brand.accent, shape: BoxShape.circle),
            child: Text(n, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800)),
          ),
          const SizedBox(width: 8),
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        ]),
      );
}
