import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../code_boxes.dart';
import '../store/account.dart';
import '../store/biometric.dart';
import '../theme.dart';

enum _Mode { signIn, signUp, reset }

/// signIn / signUp start on the form; both signUp and reset then confirm the number with an SMS code,
/// and reset ends by choosing a new PIN.
enum _Step { form, otp, newPin }

/// Sign in or create an account - both on one screen. Ordering needs one; the cart does not.
/// Creating an account (and recovering a forgotten PIN) confirms the mobile number with an SMS code.
/// Pops with `true` once signed in, so the caller (e.g. "Proceed to checkout") can carry on.
class CustomerLoginScreen extends ConsumerStatefulWidget {
  const CustomerLoginScreen({super.key, this.reason, this.startWithSignUp = false});

  /// Why we are asking, shown under the title (e.g. "Sign in to place your order").
  final String? reason;
  final bool startWithSignUp;

  /// Shows the screen if the customer is not signed in yet; true when they are (already, or now).
  static Future<bool> ensure(BuildContext context, {String? reason}) async {
    if (ProviderScope.containerOf(context, listen: false).read(accountProvider).signedIn) return true;
    final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => CustomerLoginScreen(reason: reason)));
    return ok == true;
  }

  @override
  ConsumerState<CustomerLoginScreen> createState() => _CustomerLoginScreenState();
}

class _CustomerLoginScreenState extends ConsumerState<CustomerLoginScreen> {
  final _phone = TextEditingController();
  final _pin = TextEditingController();
  final _pin2 = TextEditingController();
  final _name = TextEditingController();
  final _otp = TextEditingController();
  late _Mode _mode = widget.startWithSignUp ? _Mode.signUp : _Mode.signIn;
  _Step _step = _Step.form;
  bool _busy = false;
  bool _showPin = false;
  String? _error;
  bool _wrongOtp = false;

  // fingerprint / face: offered when this phone has one and a PIN is saved for it
  bool _bioReady = false;
  String _bioLabel = 'fingerprint';

  Timer? _ticker;
  int _resendIn = 0;

  String get _digits => _phone.text.replaceAll(RegExp(r'\D'), '');

  @override
  void initState() {
    super.initState();
    _initBiometric();
  }

  Future<void> _initBiometric() async {
    if (!ref.read(accountProvider.notifier).biometricSaved || !await Biometric.available()) return;
    final label = await Biometric.label();
    if (!mounted) return;
    setState(() {
      _bioReady = true;
      _bioLabel = label;
    });
    // straight to the prompt on a screen opened to sign in; the PIN stays one tap away
    if (_mode == _Mode.signIn) unawaited(_signInWithBiometric());
  }

  @override
  void dispose() {
    _ticker?.cancel();
    for (final c in [_phone, _pin, _pin2, _name, _otp]) {
      c.dispose();
    }
    super.dispose();
  }

  void _startTicker(int seconds) {
    _ticker?.cancel();
    setState(() => _resendIn = seconds);
    _ticker = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted || _resendIn <= 1) {
        t.cancel();
        if (mounted) setState(() => _resendIn = 0);
      } else {
        setState(() => _resendIn--);
      }
    });
  }

  String? _checkForm() {
    if (_mode == _Mode.signUp && _name.text.trim().length < 2) return 'Please enter your name.';
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(_digits)) return 'Enter a valid 10-digit mobile number.';
    if (_mode != _Mode.reset) {
      if (!RegExp(r'^\d{5}$').hasMatch(_pin.text)) return 'The PIN is 5 digits.';
      if (_mode == _Mode.signUp && _pin2.text != _pin.text) return 'The two PINs do not match.';
    }
    return null;
  }

  /// Runs [job], showing its failure on the screen.
  Future<bool> _run(Future<void> Function() job) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await job();
      if (mounted) setState(() => _busy = false);
      return true;
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Something went wrong. Please try again.');
    }
    if (mounted) setState(() => _busy = false);
    return false;
  }

  Future<void> _submitForm() async {
    final problem = _checkForm();
    if (problem != null) return setState(() => _error = problem);
    if (_mode == _Mode.signIn) {
      final nav = Navigator.of(context);
      final ok = await _run(() => ref.read(accountProvider.notifier).signIn(_digits, _pin.text));
      if (ok) await _done(nav, offerBiometric: true);
    } else {
      await _sendCode();
    }
  }

  Future<void> _sendCode() async {
    final ok = await _run(() async {
      final wait = await ref.read(accountProvider.notifier).sendOtp(_digits, reset: _mode == _Mode.reset);
      _startTicker(wait);
    });
    if (ok && mounted) {
      _otp.clear();
      setState(() {
        _step = _Step.otp;
        _wrongOtp = false;
      });
    }
  }

  Future<void> _codeEntered(String code) async {
    FocusScope.of(context).unfocus();
    if (_mode == _Mode.reset) {
      // the server checks the code together with the new PIN, in the next step
      _pin.clear();
      _pin2.clear();
      return setState(() {
        _step = _Step.newPin;
        _error = null;
      });
    }
    final nav = Navigator.of(context);
    final ok = await _run(() => ref.read(accountProvider.notifier).signIn(_digits, _pin.text, name: _name.text.trim(), signUp: true, otp: code));
    if (ok) return _done(nav, offerBiometric: true);
    if (mounted) setState(() => _wrongOtp = true);
  }

  Future<void> _submitNewPin() async {
    if (!RegExp(r'^\d{5}$').hasMatch(_pin.text)) return setState(() => _error = 'The PIN is 5 digits.');
    if (_pin2.text != _pin.text) return setState(() => _error = 'The two PINs do not match.');
    final nav = Navigator.of(context);
    final ok = await _run(() => ref.read(accountProvider.notifier).resetPin(_digits, _otp.text, _pin.text));
    if (ok) return _done(nav, offerBiometric: true);
    // a wrong or expired code is the likely reason: back to the code step
    if (mounted && _error != null && _error!.contains('code')) {
      setState(() {
        _step = _Step.otp;
        _otp.clear();
        _wrongOtp = true;
      });
    }
  }

  Future<void> _signInWithBiometric() async {
    if (_busy) return;
    if (!await Biometric.confirm('Sign in to Gaia')) return;
    if (!mounted) return;
    final nav = Navigator.of(context);
    final ok = await _run(() => ref.read(accountProvider.notifier).signInSaved());
    if (ok) {
      nav.pop(true);
    } else if (mounted && !ref.read(accountProvider.notifier).biometricSaved) {
      // the saved PIN no longer works (changed elsewhere): back to typing it
      setState(() => _bioReady = false);
    }
  }

  /// Signed in. First time on a phone that has a fingerprint / face: offer to use it next time.
  Future<void> _done(NavigatorState nav, {required bool offerBiometric}) async {
    final store = ref.read(accountProvider.notifier);
    if (offerBiometric && mounted && !(store.biometricSaved && store.biometricPhone == _digits) && await Biometric.available()) {
      final label = await Biometric.label();
      if (!mounted) return;
      final yes = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          icon: const Icon(Icons.fingerprint_rounded, size: 40, color: Brand.accent),
          title: const Text('Sign in faster?'),
          content: Text('Use your $label instead of typing your PIN next time. Your PIN stays safe on this phone.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Not now')),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: Text('Use $label')),
          ],
        ),
      );
      // the phone checks it is really them before the PIN is stored behind it
      if (yes == true && await Biometric.confirm('Confirm to turn on $label sign-in')) {
        await store.saveBiometric(_digits, _pin.text);
      }
    }
    if (mounted) nav.pop(true);
  }

  void _switch(_Mode m) => setState(() {
        _mode = m;
        _step = _Step.form;
        _error = null;
        _wrongOtp = false;
        _ticker?.cancel();
        _resendIn = 0;
        _pin.clear();
        _pin2.clear();
        _otp.clear();
      });

  /// Back one step inside the flow; leaves the screen from the first step.
  void _back() {
    if (_step == _Step.form) {
      Navigator.of(context).maybePop();
      return;
    }
    setState(() {
      _error = null;
      _step = _step == _Step.newPin ? _Step.otp : _Step.form;
      if (_step == _Step.form) {
        _ticker?.cancel();
        _resendIn = 0;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final inner = _step == _Step.form
        ? _form()
        : _step == _Step.otp
            ? _otpStep()
            : _newPinStep();
    return PopScope(
      canPop: _step == _Step.form,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        appBar: AppBar(leading: _step == _Step.form ? null : IconButton(icon: const Icon(Icons.arrow_back_rounded), onPressed: _busy ? null : _back)),
        body: AutofillGroup(child: ListView(padding: const EdgeInsets.fromLTRB(24, 0, 24, 24), children: [inner])),
      ),
    );
  }

  Widget _errorBox() => _error == null
      ? const SizedBox.shrink()
      : Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFFFDECEE), borderRadius: BorderRadius.circular(12)),
          child: Text(_error!, style: const TextStyle(color: Color(0xFFB3202D), fontWeight: FontWeight.w600)),
        );

  Widget _logo() => Image.asset('assets/images/gaia-logo.jpg', height: 64, alignment: Alignment.centerLeft, fit: BoxFit.contain);

  Widget _title(String title, String sub) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text(sub, style: const TextStyle(color: Brand.muted, fontSize: 14.5, height: 1.4)),
      ]);

  Widget _label(String t) => Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(t, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: Brand.muted)));

  Widget _pinToggle() => Align(
        alignment: Alignment.centerRight,
        child: TextButton.icon(
          onPressed: () => setState(() => _showPin = !_showPin),
          icon: Icon(_showPin ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18),
          label: Text(_showPin ? 'Hide PIN' : 'Show PIN'),
        ),
      );

  Widget _button(String label, VoidCallback onTap) => FilledButton(
        onPressed: _busy ? null : onTap,
        child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : Text(label),
      );

  // ---- step 1: the form ----

  Widget _form() {
    final signUp = _mode == _Mode.signUp, reset = _mode == _Mode.reset;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _logo(),
      const SizedBox(height: 20),
      _title(
        reset ? 'Reset your PIN' : signUp ? 'Create your account' : 'Welcome back',
        widget.reason ??
            (reset
                ? 'Enter your mobile number. We will text you a code to choose a new PIN.'
                : signUp
                    ? 'One account for all your Gaia orders, on any phone. We will text a code to confirm your number.'
                    : 'Sign in with your mobile number and 5-digit PIN.'),
      ),
      const SizedBox(height: 22),
      if (!reset) ...[
        // both choices side by side, always visible
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(14)),
          child: Row(children: [_tab('Sign in', !signUp, () => _switch(_Mode.signIn)), _tab('Create account', signUp, () => _switch(_Mode.signUp))]),
        ),
        const SizedBox(height: 22),
      ],
      _errorBox(),
      if (signUp) ...[
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
        textInputAction: reset ? TextInputAction.done : TextInputAction.next,
        onSubmitted: (_) => reset && !_busy ? _submitForm() : null,
        autofillHints: const [AutofillHints.telephoneNumberNational],
        decoration: const InputDecoration(labelText: 'Mobile number', prefixText: '+91  ', prefixIcon: Icon(Icons.phone_outlined), counterText: ''),
      ),
      if (!reset) ...[
        const SizedBox(height: 20),
        _label(signUp ? 'Choose a 5-digit PIN' : '5-digit PIN'),
        CodeBoxes(controller: _pin, length: 5, obscure: !_showPin, hasError: _error != null && _error!.contains('PIN'), onCompleted: (_) => signUp ? null : _submitForm()),
        if (signUp) ...[
          const SizedBox(height: 16),
          _label('Enter the PIN again'),
          CodeBoxes(controller: _pin2, length: 5, obscure: !_showPin, hasError: _error != null && _error!.contains('match')),
        ],
        _pinToggle(),
      ],
      const SizedBox(height: 14),
      _button(reset ? 'Send code' : signUp ? 'Send code' : 'Sign in', _submitForm),
      if (!signUp && !reset && _bioReady) ...[
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: _busy ? null : _signInWithBiometric,
          icon: const Icon(Icons.fingerprint_rounded),
          label: Text('Sign in with $_bioLabel'),
        ),
      ],
      const SizedBox(height: 10),
      if (_mode == _Mode.signIn) Center(child: TextButton(onPressed: _busy ? null : () => _switch(_Mode.reset), child: const Text('Forgot your PIN?'))),
      Center(
        child: TextButton(
          onPressed: _busy ? null : () => _switch(reset ? _Mode.signIn : signUp ? _Mode.signIn : _Mode.signUp),
          child: Text(reset ? 'Back to sign in' : signUp ? 'Already have an account? Sign in' : 'New to Gaia? Create an account'),
        ),
      ),
    ]);
  }

  // ---- step 2: the SMS code ----

  Widget _otpStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _logo(),
      const SizedBox(height: 20),
      _title('Enter the code', 'We texted a 6-digit code to +91 $_digits. It works for 10 minutes.'),
      const SizedBox(height: 26),
      _errorBox(),
      if (_wrongOtp && _error == null)
        const Padding(padding: EdgeInsets.only(bottom: 12), child: Text('That code did not work. Check it or ask for a new one.', style: TextStyle(color: Brand.danger, fontWeight: FontWeight.w600))),
      CodeBoxes(
        controller: _otp,
        length: 6,
        otp: true,
        autofocus: true,
        hasError: _wrongOtp,
        onChanged: (_) => _wrongOtp ? setState(() => _wrongOtp = false) : null,
        onCompleted: _busy ? null : _codeEntered,
      ),
      const SizedBox(height: 22),
      if (_busy) const Center(child: CircularProgressIndicator(strokeWidth: 2.5)) else _button(_mode == _Mode.reset ? 'Continue' : 'Verify and create account', () {
        if (_otp.text.length == 6) {
          _codeEntered(_otp.text);
        } else {
          setState(() => _error = 'Enter the 6-digit code.');
        }
      }),
      const SizedBox(height: 10),
      Center(
        child: TextButton(
          onPressed: _busy || _resendIn > 0 ? null : _sendCode,
          child: Text(_resendIn > 0 ? 'Send the code again in ${_resendIn}s' : 'Send the code again'),
        ),
      ),
      Center(child: TextButton(onPressed: _busy ? null : _back, child: const Text('Change the mobile number'))),
    ]);
  }

  // ---- step 3 (reset only): the new PIN ----

  Widget _newPinStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _logo(),
      const SizedBox(height: 20),
      _title('Choose a new PIN', 'Your number is confirmed. Pick a 5-digit PIN you will remember.'),
      const SizedBox(height: 26),
      _errorBox(),
      _label('New 5-digit PIN'),
      CodeBoxes(controller: _pin, length: 5, obscure: !_showPin, autofocus: true),
      const SizedBox(height: 16),
      _label('Enter the PIN again'),
      CodeBoxes(controller: _pin2, length: 5, obscure: !_showPin, hasError: _error != null && _error!.contains('match'), onCompleted: (_) => _busy ? null : _submitNewPin()),
      _pinToggle(),
      const SizedBox(height: 14),
      _button('Save PIN and sign in', _submitNewPin),
    ]);
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
