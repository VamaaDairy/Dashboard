import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../config.dart';
import '../models.dart';
import '../store/account.dart';
import '../store/subscriptions.dart';
import '../theme.dart';
import 'address_picker_screen.dart';
import 'customer_login_screen.dart';
import 'distributor_login_screen.dart';
import 'my_calendar_screen.dart';
import 'orders_screen.dart';
import 'rider_login_screen.dart';

/// Who you are (name, number, delivery address - all editable), your orders and
/// subscriptions, the partner logins, and about the app.
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  void _go(BuildContext context, Widget page) => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));

  void _toast(BuildContext context, String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('Your orders and subscriptions stay with your account. Sign in again any time.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(c, true), style: TextButton.styleFrom(foregroundColor: Brand.danger), child: const Text('Sign out')),
        ],
      ),
    );
    if (ok == true) await ref.read(accountProvider.notifier).signOut();
  }

  Future<void> _editName(BuildContext context, WidgetRef ref, String now) async {
    final name = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (c) => _NameSheet(initial: now),
    );
    if (name == null || name == now || !context.mounted) return;
    try {
      await ref.read(accountProvider.notifier).rename(name);
      if (context.mounted) _toast(context, 'Name updated');
    } on ApiException catch (e) {
      if (context.mounted) _toast(context, e.message);
    } catch (_) {
      if (context.mounted) _toast(context, 'Could not save. Please try again.');
    }
  }

  Future<void> _editAddress(BuildContext context, WidgetRef ref, Customer c) async {
    final picked = await Navigator.of(context).push<PickedLocation>(MaterialPageRoute(
      builder: (_) => AddressPickerScreen(initial: c.lat == null || c.lng == null ? null : PickedLocation(lat: c.lat!, lng: c.lng!, address: c.address)),
    ));
    if (picked == null) return;
    await ref.read(accountProvider.notifier).setAddress(address: picked.address, pincode: picked.pincode ?? '', lat: picked.lat, lng: picked.lng);
    if (context.mounted) _toast(context, 'Delivery address saved');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final acc = ref.watch(accountProvider);
    final subs = ref.watch(subscriptionsProvider.select((s) => s.subscriptions.length));
    final c = acc.customer;
    final initials = c.name.trim().isEmpty ? '?' : c.name.trim().split(RegExp(r'\s+')).take(2).map((w) => w[0].toUpperCase()).join();

    Widget band() => Container(height: 8, color: Brand.surface);
    Widget heading(String t) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
          child: Text(t, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        );
    Widget gap() => const Padding(padding: EdgeInsets.only(left: 62), child: Divider());

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        automaticallyImplyLeading: false,
        titleSpacing: 20,
        title: const Text('Account', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          // who you are
          if (acc.signedIn)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(c.name.isEmpty ? 'Welcome' : c.name,
                        maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: -0.3, height: 1.2)),
                    const SizedBox(height: 4),
                    Text('+91 ${c.phone}', style: const TextStyle(fontSize: 14.5, color: Brand.muted, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 10),
                    GestureDetector(
                      onTap: () => _editName(context, ref, c.name),
                      child: const Text('Edit profile', style: TextStyle(color: Brand.accent, fontWeight: FontWeight.w700, fontSize: 14)),
                    ),
                  ]),
                ),
                const SizedBox(width: 16),
                CircleAvatar(
                  radius: 34,
                  backgroundColor: Brand.accentTint,
                  child: Text(initials, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Brand.accent)),
                ),
              ]),
            )
          else
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Welcome to Gaia', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: -0.3)),
                const SizedBox(height: 6),
                const Text('Sign in to order, subscribe and track your deliveries on any phone.',
                    style: TextStyle(color: Brand.muted, fontSize: 14.5, height: 1.4)),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => _go(context, const CustomerLoginScreen()),
                  style: FilledButton.styleFrom(minimumSize: const Size(220, 48)),
                  child: const Text('Sign in or create account'),
                ),
              ]),
            ),
          // the two numbers that matter
          if (acc.signedIn)
            Container(
              margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(14)),
              child: IntrinsicHeight(
                child: Row(children: [
                  Expanded(child: _Count(value: acc.orders.length, label: 'Orders', onTap: () => _go(context, const OrdersScreen()))),
                  const VerticalDivider(width: 1, color: Brand.line),
                  Expanded(child: _Count(value: subs, label: 'Subscriptions', onTap: () => _go(context, const MyCalendarScreen()))),
                ]),
              ),
            ),
          band(),
          heading('Your account'),
          _Row(icon: Icons.receipt_long_outlined, title: 'Your orders', subtitle: 'Track, see past orders, order again', onTap: () => _go(context, const OrdersScreen())),
          gap(),
          _Row(icon: Icons.calendar_month_outlined, title: 'Calendar & subscriptions', subtitle: 'Skip days, vacation, pause', onTap: () => _go(context, const MyCalendarScreen())),
          if (acc.signedIn) ...[
            gap(),
            _Row(
              icon: Icons.location_on_outlined,
              title: 'Delivery address',
              subtitle: c.address.isEmpty ? 'Add the address we deliver to' : c.address,
              onTap: () => _editAddress(context, ref, c),
            ),
            gap(),
            _Row(icon: Icons.person_outline_rounded, title: 'Name', subtitle: c.name.isEmpty ? 'Add your name' : c.name, onTap: () => _editName(context, ref, c.name)),
          ],
          const SizedBox(height: 8),
          band(),
          heading('Partners'),
          _Row(icon: Icons.two_wheeler_rounded, title: 'Delivery partner', subtitle: 'Sign in to deliver orders', onTap: () => _go(context, const RiderLoginScreen())),
          gap(),
          _Row(icon: Icons.storefront_outlined, title: 'Distributor', subtitle: 'Sign in to place your orders', onTap: () => _go(context, const DistributorLoginScreen())),
          const SizedBox(height: 8),
          band(),
          heading('More'),
          _Row(icon: Icons.description_outlined, title: 'Licences', subtitle: 'Open-source software in this app', onTap: () => showLicensePage(context: context, applicationName: appName)),
          if (acc.signedIn) ...[
            gap(),
            InkWell(
              onTap: () => _signOut(context, ref),
              child: const Padding(
                padding: EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: Row(children: [
                  Icon(Icons.logout_rounded, size: 22, color: Brand.danger),
                  SizedBox(width: 20),
                  Text('Sign out', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Brand.danger)),
                ]),
              ),
            ),
          ],
          const SizedBox(height: 28),
          const Center(child: Text('Gaia · $tagline', style: TextStyle(color: Brand.faint, fontSize: 12.5, fontWeight: FontWeight.w600))),
          const SizedBox(height: 2),
          const Center(child: Text('Fresh dairy from Vamaa Dairy', style: TextStyle(color: Brand.faint, fontSize: 12))),
        ],
      ),
    );
  }
}

class _Count extends StatelessWidget {
  const _Count({required this.value, required this.label, required this.onTap});
  final int value;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Column(children: [
            Text('$value', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 13, color: Brand.muted, fontWeight: FontWeight.w600)),
          ]),
        ),
      );
}

/// A plain line: outline icon, title, one line of detail, chevron.
class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 14, 14),
          child: Row(children: [
            Icon(icon, size: 22, color: Brand.ink),
            const SizedBox(width: 20),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 2),
                Text(subtitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Brand.muted, fontSize: 13, height: 1.3)),
              ]),
            ),
            const Icon(Icons.chevron_right_rounded, color: Brand.faint),
          ]),
        ),
      );
}

/// Bottom sheet to change the name; returns the new name.
class _NameSheet extends StatefulWidget {
  const _NameSheet({required this.initial});
  final String initial;

  @override
  State<_NameSheet> createState() => _NameSheetState();
}

class _NameSheetState extends State<_NameSheet> {
  late final _c = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ok = _c.text.trim().length >= 2;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Your name', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        const Text('Shown to your delivery partner.', style: TextStyle(color: Brand.muted)),
        const SizedBox(height: 16),
        TextField(
          controller: _c,
          autofocus: true,
          textCapitalization: TextCapitalization.words,
          maxLength: 80,
          decoration: const InputDecoration(hintText: 'Full name', counterText: ''),
          onChanged: (_) => setState(() {}),
          onSubmitted: (v) => ok ? Navigator.pop(context, v.trim().replaceAll(RegExp(r'\s+'), ' ')) : null,
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: ok ? () => Navigator.pop(context, _c.text.trim().replaceAll(RegExp(r'\s+'), ' ')) : null,
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
          child: const Text('Save'),
        ),
      ]),
    );
  }
}
