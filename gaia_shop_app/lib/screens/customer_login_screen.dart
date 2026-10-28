import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../code_boxes.dart';
import '../pin_pad.dart';
import '../store/account.dart';
import '../store/biometric.dart';
import '../theme.dart';

enum _Mode { signIn, signUp, reset }

/// One thing per screen, each with our own on-screen number pad (no system keyboard, except for the name).
/// signIn: mobile -> PIN. signUp: name -> mobile -> SMS code -> choose PIN -> confirm PIN.
/// reset: mobile -> SMS code -> choose PIN -> confirm PIN.
enum _Step { name, mobile, signInPin, otp, createPin, confirmPin }

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
  bool _pinMismatch = false;
  final _name = TextEditingController();
  final _otp = TextEditingController();
  late _Mode _mode = widget.startWithSignUp ? _Mode.signUp : _Mode.signIn;
  late _Step _step = _first;
  bool _busy = false;
  String? _error;
  bool _wrongOtp = false;

  // fingerprint / face: offered when this phone has one and a PIN is saved for it
  bool _bioReady = false;
  String _bioLabel = 'fingerprint';

  Timer? _ticker;
  int _resendIn = 0;

  _Step get _first => _mode == _Mode.signUp ? _Step.name : _Step.mobile;

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

  void _nameDone() {
    if (_name.text.trim().length < 2) return setState(() => _error = 'Please enter your name.');
    FocusScope.of(context).unfocus();
    setState(() {
      _step = _Step.mobile;
      _error = null;
    });
  }

  Future<void> _mobileDone() async {
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(_digits)) return setState(() => _error = 'Enter a valid 10-digit mobile number.');
    if (_mode == _Mode.signIn) {
      setState(() {
        _step = _Step.signInPin;
        _error = null;
        _pin.clear();
      });
    } else {
      await _sendCode();
    }
  }

  Future<void> _signInPinEntered(String pin) async {
    final nav = Navigator.of(context);
    final ok = await _run(() => ref.read(accountProvider.notifier).signIn(_digits, pin));
    if (ok) return _done(nav, offerBiometric: true);
    if (mounted) {
      HapticFeedback.heavyImpact();
      setState(() => _pin.clear());
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

  /// The SMS code is checked by the server together with the PIN, at the end: now choose the PIN.
  void _codeEntered(String code) {
    FocusScope.of(context).unfocus();
    _pin.clear();
    _pin2.clear();
    setState(() {
      _step = _Step.createPin;
      _error = null;
      _pinMismatch = false;
    });
  }

  void _pinChosen(String pin) {
    // a beat so the last dot is seen filling before the screen changes
    Future.delayed(const Duration(milliseconds: 180), () {
      if (!mounted || _step != _Step.createPin || _pin.text != pin) return;
      setState(() {
        _step = _Step.confirmPin;
        _pin2.clear();
        _pinMismatch = false;
      });
    });
  }

  Future<void> _pinConfirmed(String again) async {
    await Future<void>.delayed(const Duration(milliseconds: 180));
    if (!mounted || _step != _Step.confirmPin || _pin2.text != again) return;
    if (again != _pin.text) {
      HapticFeedback.heavyImpact();
      setState(() => _pinMismatch = true);
      await Future<void>.delayed(const Duration(milliseconds: 600));
      if (mounted) {
        setState(() {
          _pin2.clear();
          _pinMismatch = false;
        });
      }
      return;
    }
    final nav = Navigator.of(context);
    final store = ref.read(accountProvider.notifier);
    final ok = await _run(() => _mode == _Mode.reset
        ? store.resetPin(_digits, _otp.text, _pin.text)
        : store.signIn(_digits, _pin.text, name: _name.text.trim(), signUp: true, otp: _otp.text));
    if (ok) return _done(nav, offerBiometric: true);
    // a wrong or expired code is the likely reason: back to the code step
    if (mounted && _error != null && _error!.contains('code')) {
      setState(() {
        _step = _Step.otp;
        _otp.clear();
        _wrongOtp = true;
      });
    } else if (mounted) {
      setState(() => _pin2.clear());
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
        _step = _first;
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
    if (_step == _first) {
      Navigator.of(context).maybePop();
      return;
    }
    setState(() {
      _error = null;
      _pinMismatch = false;
      _pin2.clear();
      _step = switch (_step) {
        _Step.confirmPin => _Step.createPin,
        _Step.createPin => _Step.otp,
        _Step.otp || _Step.signInPin => _Step.mobile,
        _ => _Step.name,
      };
      if (_step == _Step.createPin || _step == _Step.mobile) _pin.clear();
      if (_step == _Step.mobile) {
        _ticker?.cancel();
        _resendIn = 0;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _step == _first,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        appBar: AppBar(leading: _step == _first ? null : IconButton(icon: const Icon(Icons.arrow_back_rounded), onPressed: _busy ? null : _back)),
        body: switch (_step) {
          _Step.name => AutofillGroup(child: ListView(padding: const EdgeInsets.fromLTRB(24, 0, 24, 24), children: [_nameStep()])),
          _Step.mobile => _mobileStep(),
          _Step.signInPin => _signInPinStep(),
          _Step.otp => _otpStep(),
          _Step.createPin || _Step.confirmPin => _pinScreen(),
        },
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

  Widget _button(String label, VoidCallback onTap) => FilledButton(
        onPressed: _busy ? null : onTap,
        child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : Text(label),
      );

  // ---- a screen with a header, something to show the digits in, and the on-screen number pad ----

  Widget _padPage({
    required List<Widget> top,
    required Widget display,
    required String value,
    required int length,
    required ValueChanged<String> onChanged,
    List<Widget> below = const [],
    Widget? action,
    bool enabled = true,
  }) {
    return SafeArea(
      child: Column(children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              ...top,
              const SizedBox(height: 28),
              Center(child: display),
              const SizedBox(height: 12),
              SizedBox(
                height: 44,
                child: Center(
                  child: _busy
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5))
                      : Text(
                          _pinMismatch ? 'The PINs do not match. Try again.' : (_error ?? ''),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Brand.danger, fontWeight: FontWeight.w600),
                        ),
                ),
              ),
              ...below,
            ]),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            if (action != null) ...[SizedBox(width: double.infinity, child: action), const SizedBox(height: 8)],
            PinPad(
              value: value,
              length: length,
              enabled: enabled && !_busy,
              onChanged: (v) {
                setState(() => _error = null);
                onChanged(v);
              },
            ),
          ]),
        ),
      ]),
    );
  }

  // ---- sign up: your name ----

  Widget _nameStep() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _logo(),
      const SizedBox(height: 20),
      _title('Create your account', widget.reason ?? 'One account for all your Gaia orders, on any phone.'),
      const SizedBox(height: 22),
      _modeTabs(),
      const SizedBox(height: 22),
      _errorBox(),
      TextField(
        controller: _name,
        autofocus: true,
        textCapitalization: TextCapitalization.words,
        textInputAction: TextInputAction.done,
        onSubmitted: (_) => _nameDone(),
        autofillHints: const [AutofillHints.name],
        decoration: const InputDecoration(labelText: 'Your name', prefixIcon: Icon(Icons.person_outline)),
      ),
      const SizedBox(height: 14),
      _button('Continue', _nameDone),
      const SizedBox(height: 10),
      Center(child: TextButton(onPressed: _busy ? null : () => _switch(_Mode.signIn), child: const Text('Already have an account? Sign in'))),
    ]);
  }

  Widget _modeTabs() => Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          _tab('Sign in', _mode != _Mode.signUp, () => _switch(_Mode.signIn)),
          _tab('Create account', _mode == _Mode.signUp, () => _switch(_Mode.signUp)),
        ]),
      );

  // ---- the mobile number ----

  String get _phoneShown {
    final d = _phone.text;
    return d.length <= 5 ? d : '${d.substring(0, 5)} ${d.substring(5)}';
  }

  Widget _mobileStep() {
    final reset = _mode == _Mode.reset, signUp = _mode == _Mode.signUp;
    return _padPage(
      top: [
        _logo(),
        const SizedBox(height: 20),
        _title(
          reset ? 'Reset your PIN' : signUp ? 'Your mobile number' : 'Welcome back',
          widget.reason ??
              (reset
                  ? 'Enter your mobile number. We will text you a code to choose a new PIN.'
                  : signUp
                      ? 'We will text a code to confirm your number.'
                      : 'Sign in with your mobile number and 5-digit PIN.'),
        ),
        if (!reset && !signUp) ...[const SizedBox(height: 18), _modeTabs()],
      ],
      display: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(color: Brand.accentTint, borderRadius: BorderRadius.circular(14), border: Border.all(color: _error != null ? Brand.danger : Brand.accent, width: 2)),
        child: Row(children: [
          const Icon(Icons.phone_outlined, color: Brand.muted),
          const SizedBox(width: 10),
          const Text('+91', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Brand.muted)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(_phone.text.isEmpty ? 'Mobile number' : _phoneShown, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: _phone.text.isEmpty ? Brand.muted : Brand.ink)),
          ),
        ]),
      ),
      value: _phone.text,
      length: 10,
      onChanged: (v) => setState(() => _phone.text = v),
      below: [
        if (!signUp && !reset && _bioReady)
          OutlinedButton.icon(onPressed: _busy ? null : _signInWithBiometric, icon: const Icon(Icons.fingerprint_rounded), label: Text('Sign in with $_bioLabel')),
        if (_mode == _Mode.signIn) Center(child: TextButton(onPressed: _busy ? null : () => _switch(_Mode.reset), child: const Text('Forgot your PIN?'))),
        if (reset) Center(child: TextButton(onPressed: _busy ? null : () => _switch(_Mode.signIn), child: const Text('Back to sign in'))),
      ],
      action: _button(reset || signUp ? 'Send code' : 'Continue', _mobileDone),
    );
  }

  // ---- sign in: the PIN ----

  Widget _signInPinStep() {
    return _padPage(
      top: [
        _logo(),
        const SizedBox(height: 20),
        _title('Enter your PIN', 'Your 5-digit PIN for +91 $_digits.'),
      ],
      display: PinDots(filled: _pin.text.length, error: _error != null),
      value: _pin.text,
      length: 5,
      onChanged: (v) {
        setState(() => _pin.text = v);
        if (v.length == 5) _signInPinEntered(v);
      },
      below: [
        if (_bioReady) OutlinedButton.icon(onPressed: _busy ? null : _signInWithBiometric, icon: const Icon(Icons.fingerprint_rounded), label: Text('Sign in with $_bioLabel')),
        Center(child: TextButton(onPressed: _busy ? null : () => _switch(_Mode.reset), child: const Text('Forgot your PIN?'))),
      ],
    );
  }

  // ---- the SMS code ----

  Widget _otpStep() {
    return _padPage(
      top: [
        _logo(),
        const SizedBox(height: 20),
        _title('Enter the code', 'We texted a 6-digit code to +91 $_digits. It works for 10 minutes.'),
      ],
      display: CodeBoxes(controller: _otp, length: 6, otp: true, systemKeyboard: false, hasError: _wrongOtp),
      value: _otp.text,
      length: 6,
      onChanged: (v) {
        setState(() {
          _otp.text = v;
          _wrongOtp = false;
        });
        if (v.length == 6) _codeEntered(v);
      },
      below: [
        if (_wrongOtp && _error == null)
          const Center(child: Text('That code did not work. Check it or ask for a new one.', textAlign: TextAlign.center, style: TextStyle(color: Brand.danger, fontWeight: FontWeight.w600))),
        Center(
          child: TextButton(
            onPressed: _busy || _resendIn > 0 ? null : _sendCode,
            child: Text(_resendIn > 0 ? 'Send the code again in ${_resendIn}s' : 'Send the code again'),
          ),
        ),
        Center(child: TextButton(onPressed: _busy ? null : _back, child: const Text('Change the mobile number'))),
      ],
    );
  }

  // ---- choose the PIN, then enter it again ----

  Widget _pinScreen() {
    final confirm = _step == _Step.confirmPin;
    final ctrl = confirm ? _pin2 : _pin;
    return _padPage(
      top: [
        _logo(),
        const SizedBox(height: 20),
        _title(
          confirm ? 'Confirm your PIN' : (_mode == _Mode.reset ? 'Choose a new PIN' : 'Create your PIN'),
          confirm ? 'Enter the same 5 digits once more.' : 'Pick a 5-digit PIN. You will use it every time you sign in.',
        ),
      ],
      display: PinDots(filled: ctrl.text.length, error: _pinMismatch),
      value: ctrl.text,
      length: 5,
      enabled: !_pinMismatch,
      onChanged: (v) {
        setState(() => ctrl.text = v);
        if (v.length == 5) confirm ? _pinConfirmed(v) : _pinChosen(v);
      },
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
