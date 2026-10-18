import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../models.dart';
import '../state/cart_state.dart';
import '../state/map_state.dart';
import '../state/orders_state.dart';
import '../theme.dart';
import '../widgets.dart';
import 'address_picker_screen.dart';
import 'order_screen.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
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
    final c = context.read<OrdersState>().customer; // remembered from the last order
    _name = TextEditingController(text: c.name);
    _phone = TextEditingController(text: c.phone);
    _address = TextEditingController(text: c.address);
    _pincode = TextEditingController(text: c.pincode);
    _lat = c.lat;
    _lng = c.lng;
    context.read<MapState>().load();
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
    final needPin = context.read<MapState>().enabled && _lat == null;
    setState(() => _pinMissing = needPin);
    if (!_form.currentState!.validate() || needPin) return;

    final cart = context.read<CartState>();
    final orders = context.read<OrdersState>();
    final nav = Navigator.of(context);
    setState(() => _placing = true);
    try {
      final order = await orders.place(
        who: Customer(name: _name.text.trim(), phone: _phone.text.trim(), address: _address.text.trim(), pincode: _pincode.text.trim(), lat: _lat, lng: _lng),
        notes: _notes.text,
        lines: cart.lines,
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
    final total = context.select<CartState, double>((c) => c.total);

    return Scaffold(
      appBar: AppBar(title: const Text('Delivery details')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFFDECEE), border: Border.all(color: const Color(0xFFF3B9BF)), borderRadius: BorderRadius.circular(12)),
                child: Text(_error!, style: const TextStyle(color: Color(0xFFB3202D), fontWeight: FontWeight.w600)),
              ),
            _locationCard(),
            _field(_name, 'Your name', 'name', autofill: const [AutofillHints.name], validator: (v) => (v ?? '').trim().length < 2 ? 'Please enter your name' : null),
            _field(_phone, 'Mobile number', 'phone',
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
                hint: 'Add your house / flat no. and landmark',
                autofill: const [AutofillHints.fullStreetAddress],
                validator: (v) => (v ?? '').trim().length < 10 ? 'Please enter your full delivery address' : null),
            _field(_pincode, 'Pincode (optional)', 'pincode',
                keyboard: TextInputType.number,
                autofill: const [AutofillHints.postalCode],
                validator: (v) => (v ?? '').trim().isNotEmpty && (v ?? '').trim().length != 6 ? 'Pincode must be 6 digits' : null),
            _field(_notes, 'Anything we should know? (optional)', 'notes', hint: 'e.g. call before delivery'),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(16)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Payment', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(color: Brand.accentTint, border: Border.all(color: Brand.accent, width: 2), borderRadius: BorderRadius.circular(12)),
                    child: const Row(
                      children: [
                        Icon(Icons.payments_outlined, color: Brand.accent),
                        SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Cash on delivery', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                              Text('Pay when your order arrives', style: TextStyle(fontSize: 12, color: Brand.muted)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const BillDetails(),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: Brand.line))),
          child: FilledButton(
            onPressed: _placing ? null : _place,
            child: _placing
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                : Text('Place order · ${rupees(total)}'),
          ),
        ),
      ),
    );
  }

  Widget _locationCard() {
    final has = _lat != null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: InkWell(
        onTap: _pickOnMap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: has ? Brand.accentTint : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _pinMissing ? Brand.danger : (has ? Brand.accent : Brand.line), width: has || _pinMissing ? 1.6 : 1),
          ),
          child: Row(
            children: [
              Icon(has ? Icons.location_on : Icons.add_location_alt_outlined, color: _pinMissing ? Brand.danger : Brand.accent),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(has ? 'Delivery pin set' : 'Set delivery location on map', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    Text(
                      has ? 'Tap to change. Riders navigate to this pin.' : (_pinMissing ? 'Please set your location so we can deliver to you.' : 'So the rider can find you quickly'),
                      style: TextStyle(fontSize: 12.5, color: _pinMissing ? Brand.danger : Brand.muted),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Brand.muted),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController c,
    String label,
    String key, {
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
        decoration: InputDecoration(labelText: label, hintText: hint, alignLabelWithHint: lines > 1),
        validator: (v) => validator?.call(v) ?? _server(key),
      ),
    );
  }
}
