import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../state/orders_state.dart';
import '../theme.dart';

/// Sign in or create an account - both on one screen. Ordering needs one; the cart does not.
/// Pops with `true` once signed in, so the caller (e.g. "Proceed to checkout") can carry on.
class CustomerLoginScreen extends StatefulWidget {
  const CustomerLoginScreen({super.key, this.reason, this.startWithSignUp = false});

  /// Why we are asking, shown under the title (e.g. "Sign in to place your order").
  final String? reason;
  final bool startWithSignUp;

  /// Shows the screen if the customer is not signed in yet; true when they are (already, or now).
  static Future<bool> ensure(BuildContext context, {String? reason}) async {
    if (context.read<OrdersState>().signedIn) return true;
    final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => CustomerLoginScreen(reason: reason)));
    return ok == true;
  }

  @override
  State<CustomerLoginScreen> createState() => _CustomerLoginScreenState();
}

class _CustomerLoginScreenState extends State<CustomerLoginScreen> {
  final _phone = TextEditingController();
  final _pin = TextEditingController();
  final _pin2 = TextEditingController();
  final _name = TextEditingController();
  late bool _signUp = widget.startWithSignUp;
  bool _busy = false;
  bool _showPin = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_phone, _pin, _pin2, _name]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _check() {
    final phone = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (_signUp && _name.text.trim().length < 2) return 'Please enter your name.';
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(phone)) return 'Enter a valid 10-digit mobile number.';
    if (!RegExp(r'^\d{5}$').hasMatch(_pin.text)) return 'The PIN is 5 digits.';
    if (_signUp && _pin2.text != _pin.text) return 'The two PINs do not match.';
    return null;
  }

  Future<void> _submit() async {
    final problem = _check();
    if (problem != null) return setState(() => _error = problem);
    final nav = Navigator.of(context);
    final orders = context.read<OrdersState>();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await orders.signIn(_phone.text.replaceAll(RegExp(r'\D'), ''), _pin.text, name: _name.text.trim(), signUp: _signUp);
      nav.pop(true);
      return;
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Something went wrong. Please try again.');
    }
    if (mounted) setState(() => _busy = false);
  }

  void _switch(bool signUp) => setState(() {
        _signUp = signUp;
        _error = null;
      });

  @override
  Widget build(BuildContext context) {
    final pinSuffix = IconButton(
      tooltip: _showPin ? 'Hide PIN' : 'Show PIN',
      icon: Icon(_showPin ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: Brand.muted),
      onPressed: () => setState(() => _showPin = !_showPin),
    );
    return Scaffold(
      appBar: AppBar(),
      body: AutofillGroup(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
          children: [
            Image.asset('assets/images/gaia-logo.jpg', height: 64, alignment: Alignment.centerLeft, fit: BoxFit.contain),
            const SizedBox(height: 20),
            Text(_signUp ? 'Create your account' : 'Welcome back', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(
              widget.reason ?? (_signUp ? 'One account for all your Gaia orders, on any phone.' : 'Sign in with your mobile number and 5-digit PIN.'),
              style: const TextStyle(color: Brand.muted, fontSize: 14.5, height: 1.4),
            ),
            const SizedBox(height: 22),
            // both choices side by side, always visible
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(14)),
              child: Row(children: [_tab('Sign in', !_signUp, () => _switch(false)), _tab('Create account', _signUp, () => _switch(true))]),
            ),
            const SizedBox(height: 22),
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFFDECEE), borderRadius: BorderRadius.circular(12)),
                child: Text(_error!, style: const TextStyle(color: Color(0xFFB3202D), fontWeight: FontWeight.w600)),
              ),
            if (_signUp) ...[
              TextField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.name],
                decoration: const InputDecoration(labelText: 'Your name', prefixIcon: Icon(Icons.person_outline)),
              ),
              const SizedBox(height: 14),
            ],
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.telephoneNumberNational],
              decoration: const InputDecoration(labelText: 'Mobile number', prefixText: '+91  ', prefixIcon: Icon(Icons.phone_outlined), counterText: ''),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _pin,
              obscureText: !_showPin,
              keyboardType: TextInputType.number,
              maxLength: 5,
              textInputAction: _signUp ? TextInputAction.next : TextInputAction.done,
              onSubmitted: (_) => _signUp || _busy ? null : _submit(),
              decoration: InputDecoration(labelText: _signUp ? 'Choose a 5-digit PIN' : '5-digit PIN', prefixIcon: const Icon(Icons.lock_outline), suffixIcon: pinSuffix, counterText: ''),
            ),
            if (_signUp) ...[
              const SizedBox(height: 14),
              TextField(
                controller: _pin2,
                obscureText: !_showPin,
                keyboardType: TextInputType.number,
                maxLength: 5,
                onSubmitted: (_) => _busy ? null : _submit(),
                decoration: const InputDecoration(labelText: 'Enter the PIN again', prefixIcon: Icon(Icons.lock_outline), counterText: ''),
              ),
            ],
            const SizedBox(height: 22),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                  : Text(_signUp ? 'Create account' : 'Sign in'),
            ),
            const SizedBox(height: 14),
            Center(
              child: TextButton(
                onPressed: _busy ? null : () => _switch(!_signUp),
                child: Text(_signUp ? 'Already have an account? Sign in' : 'New to Gaia? Create an account'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tab(String label, bool on, VoidCallback onTap) => Expanded(
        child: GestureDetector(
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: on ? Colors.white : Colors.transparent,
              borderRadius: BorderRadius.circular(11),
              boxShadow: on ? const [BoxShadow(color: Color(0x14000000), blurRadius: 6, offset: Offset(0, 2))] : null,
            ),
            child: Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: on ? Brand.accent : Brand.muted)),
          ),
        ),
      );
}
