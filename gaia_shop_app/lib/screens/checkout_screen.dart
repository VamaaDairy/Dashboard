import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../models.dart';
import '../store/account.dart';
import '../store/cart.dart';
import '../store/catalog.dart';
import '../store/map.dart';
import '../theme.dart';
import '../ui.dart';
import '../widgets.dart';
import 'customer_login_screen.dart';
import 'edit_profile_screen.dart';
import 'order_screen.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _notes = TextEditingController();

  bool _placing = false;

  /// Pay online (Easebuzz) rather than cash - the default whenever the server takes online payments.
  bool _online = true;
  bool _detailsMissing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    ref.read(mapProvider.notifier).load();
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  /// Name, number and delivery address live on the profile; checkout only shows them and opens it to change.
  Future<void> _editDetails() async {
    await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const EditProfileScreen()));
    if (mounted) setState(() => _detailsMissing = !_detailsOk(ref.read(accountProvider).customer));
  }

  bool _detailsOk(Customer c) {
    final pinNeeded = ref.read(mapProvider).enabled;
    return c.name.trim().length >= 2 && c.address.trim().length >= 10 && (!pinNeeded || c.lat != null);
  }

  Future<void> _place() async {
    setState(() => _error = null);
    final who = ref.read(accountProvider).customer;
    if (!_detailsOk(who)) {
      setState(() => _detailsMissing = true);
      await _editDetails();
      return;
    }

    final cart = ref.read(cartProvider.notifier);
    final lines = ref.read(cartProvider).lines;
    final orders = ref.read(accountProvider.notifier);
    final nav = Navigator.of(context);
    setState(() => _placing = true);
    try {
      final online = _online && (ref.read(catalogProvider).catalog?.payOnline ?? false);
      var order = await orders.place(who: who, notes: _notes.text, lines: lines, payOnline: online);
      cart.clear();
      // the order exists, waiting for its money: pay now; if it does not go through, the order screen
      // offers to try again or to pay in cash
      if (online) {
        try {
          order = await orders.payOnline(order);
        } catch (_) {}
      }
      // back to the menu, with the order on top
      nav.pushAndRemoveUntil(MaterialPageRoute<void>(builder: (_) => OrderScreen(order: order, justPlaced: true)), (r) => r.isFirst);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _placing = false;
        _error = e.message;
      });
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
    final cartState = ref.watch(cartProvider);
    final total = cartState.total;
    final count = cartState.count;
    final payOnline = ref.watch(catalogProvider.select((c) => c.catalog?.payOnline ?? false));
    final online = payOnline && _online;
    final who = ref.watch(accountProvider.select((a) => a.customer));

    return Scaffold(
      backgroundColor: Brand.surface,
      appBar: AppBar(title: const Text('Checkout')),
      body: ListView(
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
          const _Step('1', 'Delivering to'),
          _deliveryCard(who),
          const SizedBox(height: 10),
          TextField(
            controller: _notes,
            textInputAction: TextInputAction.done,
            decoration: const InputDecoration(
              labelText: 'Delivery note (optional)',
              hintText: 'e.g. ring the bell, call before delivery',
              prefixIcon: Icon(Icons.sticky_note_2_outlined, size: 20),
              filled: true,
              fillColor: Colors.white,
            ),
          ),
          const SizedBox(height: 18),
          _Step('2', 'Your order ($count ${count == 1 ? 'item' : 'items'})'),
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            child: Column(children: [
              for (var i = 0; i < cartState.lines.length; i++) ...[
                if (i > 0) const Divider(height: 1, color: Brand.line),
                _OrderLine(cartState.lines[i]),
              ],
            ]),
          ),
          const SizedBox(height: 18),
          const _Step('3', 'Payment'),
          if (payOnline) ...[
            _PayOption(
              icon: Icons.account_balance_wallet_outlined,
              title: 'Pay online',
              sub: 'UPI, cards, net banking - secured by Easebuzz',
              selected: _online,
              onTap: () => setState(() => _online = true),
            ),
            const SizedBox(height: 10),
          ],
          _PayOption(
            icon: Icons.payments_outlined,
            title: 'Cash on delivery',
            sub: 'Pay when your order arrives',
            selected: !_online || !payOnline,
            onTap: () => setState(() => _online = false),
          ),
          const SizedBox(height: 18),
          const BillDetails(),
        ],
      ),
      bottomNavigationBar: StickyBar(
        child: Row(children: [
          Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(rupees(total), style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
            Text('$count ${count == 1 ? 'item' : 'items'} · ${online ? 'online' : 'cash'}', style: const TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(width: 16),
          Expanded(
            child: FilledButton(
              onPressed: _placing ? null : _place,
              style: FilledButton.styleFrom(backgroundColor: Brand.veg),
              child: _placing
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                  : Text(online ? 'Pay ${rupees(total)}' : 'Place order'),
            ),
          ),
        ]),
      ),
    );
  }

  /// Who the order is for and where it goes, read from the profile; "Change" opens the profile screen.
  Widget _deliveryCard(Customer who) {
    final complete = _detailsOk(who);
    final warn = _detailsMissing && !complete;
    final c = warn ? Brand.danger : Brand.accent;
    final hasAddress = who.address.trim().isNotEmpty;
    final mapOn = ref.watch(mapProvider).enabled;
    return AppCard(
      onTap: _editDetails,
      padding: const EdgeInsets.all(14),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        IconTile(hasAddress && who.lat != null ? Icons.location_on_rounded : Icons.add_location_alt_outlined, color: c, size: 46),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              who.name.trim().isEmpty ? 'Add your details' : who.name.trim(),
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: warn ? Brand.danger : Brand.ink),
            ),
            if (who.phone.isNotEmpty) ...[
              const SizedBox(height: 1),
              Text('+91 ${who.phone}', style: const TextStyle(fontSize: 13, color: Brand.muted, fontWeight: FontWeight.w500)),
            ],
            const SizedBox(height: 6),
            Text(
              hasAddress ? who.address.trim() : 'Add the address and map location we deliver to',
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 13.5, height: 1.35, color: hasAddress ? Brand.ink : (warn ? Brand.danger : Brand.muted)),
            ),
            if (who.pincode.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(who.pincode, style: const TextStyle(fontSize: 12.5, color: Brand.muted)),
            ],
            if (hasAddress && who.lat == null && mapOn) ...[
              const SizedBox(height: 6),
              Text('Set your location on the map', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: warn ? Brand.danger : Brand.warn)),
            ],
          ]),
        ),
        const SizedBox(width: 8),
        Text(complete ? 'Change' : 'Add', style: TextStyle(color: c, fontWeight: FontWeight.w800)),
      ]),
    );
  }
}

/// One cart line on the checkout summary: name and size, quantity, and what it comes to.
class _OrderLine extends StatelessWidget {
  const _OrderLine(this.line);
  final CartLine line;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(line.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
              if ((line.size ?? '').isNotEmpty) Text(line.size!, style: const TextStyle(fontSize: 12.5, color: Brand.muted)),
            ]),
          ),
          const SizedBox(width: 12),
          Text('× ${line.qty}', style: const TextStyle(color: Brand.muted, fontWeight: FontWeight.w600)),
          const SizedBox(width: 14),
          Text(rupees(line.total), style: const TextStyle(fontWeight: FontWeight.w800)),
        ]),
      );
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

/// One way to pay, as a card with a radio dot.
class _PayOption extends StatelessWidget {
  const _PayOption({required this.icon, required this.title, required this.sub, required this.selected, required this.onTap});
  final IconData icon;
  final String title;
  final String sub;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: selected ? Brand.accent : Brand.line, width: selected ? 1.6 : 1),
          ),
          child: Row(children: [
            IconTile(icon, color: selected ? Brand.accent : Brand.muted),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                Text(sub, style: const TextStyle(fontSize: 12.5, color: Brand.muted)),
              ]),
            ),
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: selected ? Brand.accent : Brand.faint, width: 2)),
              child: selected ? Center(child: Container(width: 12, height: 12, decoration: const BoxDecoration(color: Brand.accent, shape: BoxShape.circle))) : null,
            ),
          ]),
        ),
      );
}
