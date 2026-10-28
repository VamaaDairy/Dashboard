import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../store/distributor.dart';
import '../theme.dart';

/// The app's front door: distributors, retailers and sales officers each sign in with the mobile
/// number and PIN Gaia gave them; the chips pick which kind of login it is.
class DistributorLoginScreen extends ConsumerStatefulWidget {
  const DistributorLoginScreen({super.key});

  @override
  ConsumerState<DistributorLoginScreen> createState() => _DistributorLoginScreenState();
}

class _DistributorLoginScreenState extends ConsumerState<DistributorLoginScreen> {
  final _phone = TextEditingController();
  final _pin = TextEditingController();
  String _kind = 'distributor'; // 'distributor' | 'retailer' | 'salesman'
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _pin.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final store = ref.read(distributorProvider.notifier);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await store.login(_phone.text.trim(), _pin.text.trim(), _kind);
      // the app root now shows the order screen
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Something went wrong. Please try again.');
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ListView(
        padding: EdgeInsets.fromLTRB(24, MediaQuery.paddingOf(context).top + 24, 24, 24),
        children: [
          Image.asset('assets/images/gaia-logo.jpg', height: 72, alignment: Alignment.centerLeft, fit: BoxFit.contain),
          const SizedBox(height: 24),
          SegmentedButton<String>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: 'distributor', label: Text('Distributor')),
              ButtonSegment(value: 'retailer', label: Text('Retailer')),
              ButtonSegment(value: 'salesman', label: Text('Sales officer')),
            ],
            selected: {_kind},
            onSelectionChanged: _busy ? null : (v) => setState(() {
              _kind = v.first;
              _error = null;
            }),
          ),
          const SizedBox(height: 24),
          Text(switch (_kind) { 'salesman' => 'Sales officer sign in', 'retailer' => 'Retailer sign in', _ => 'Distributor sign in' }, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(switch (_kind) { 'salesman' => 'Use the mobile number and PIN given to you by Gaia to book orders for distributors.', 'retailer' => 'Use the mobile number and PIN given to you by Gaia to order for your shop.', _ => 'Use the mobile number and PIN given to you by Gaia to order for your firm.' }, style: TextStyle(color: Brand.muted)),
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
          TextField(
            controller: _pin,
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 8,
            onSubmitted: (_) => _busy ? null : _login(),
            decoration: const InputDecoration(labelText: 'PIN', counterText: ''),
          ),
          const SizedBox(height: 22),
          FilledButton(
            onPressed: _busy ? null : _login,
            child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Text('Sign in'),
          ),
        ],
      ),
    );
  }
}
