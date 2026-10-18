import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../state/orders_state.dart';
import '../theme.dart';

/// Customers sign in with their mobile number and a 5-digit PIN. The first time a number is used,
/// the PIN typed here becomes its PIN and the account is created.
class CustomerLoginScreen extends StatefulWidget {
  const CustomerLoginScreen({super.key});

  @override
  State<CustomerLoginScreen> createState() => _CustomerLoginScreenState();
}

class _CustomerLoginScreenState extends State<CustomerLoginScreen> {
  final _phone = TextEditingController();
  final _pin = TextEditingController();
  final _name = TextEditingController();
  bool _busy = false;
  bool _newHere = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _pin.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final nav = Navigator.of(context);
    final orders = context.read<OrdersState>();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await orders.signIn(_phone.text.trim(), _pin.text.trim(), name: _newHere ? _name.text.trim() : '');
      nav.pop();
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          if (e.message.contains('name')) _newHere = true; // no account for this number yet
        });
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Something went wrong. Please try again.');
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
        children: [
          Image.asset('assets/images/gaia-logo.jpg', height: 72, alignment: Alignment.centerLeft, fit: BoxFit.contain),
          const SizedBox(height: 24),
          Text(_newHere ? 'Create your account' : 'Sign in', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(
            _newHere ? 'Choose a 5-digit PIN. You will use it every time you sign in.' : 'Use your mobile number and 5-digit PIN to see your orders on any phone.',
            style: const TextStyle(color: Brand.muted),
          ),
          const SizedBox(height: 24),
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFFDECEE), borderRadius: BorderRadius.circular(12)),
              child: Text(_error!, style: const TextStyle(color: Color(0xFFB3202D), fontWeight: FontWeight.w600)),
            ),
          TextField(controller: _phone, keyboardType: TextInputType.phone, maxLength: 10, decoration: const InputDecoration(labelText: 'Mobile number', counterText: '')),
          const SizedBox(height: 14),
          if (_newHere) ...[
            TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Your name')),
            const SizedBox(height: 14),
          ],
          TextField(
            controller: _pin,
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 5,
            onSubmitted: (_) => _busy ? null : _submit(),
            decoration: const InputDecoration(labelText: '5-digit PIN', counterText: ''),
          ),
          const SizedBox(height: 22),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                : Text(_newHere ? 'Create account' : 'Continue'),
          ),
        ],
      ),
    );
  }
}
