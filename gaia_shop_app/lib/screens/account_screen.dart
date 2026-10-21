import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config.dart';
import '../store/account.dart';
import '../store/subscriptions.dart';
import '../theme.dart';
import '../ui.dart';
import 'customer_login_screen.dart';
import 'distributor_login_screen.dart';
import 'my_calendar_screen.dart';
import 'orders_screen.dart';
import 'rider_login_screen.dart';

/// Who you are, your orders and subscriptions, the partner logins, and about the app.
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

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

  void _go(BuildContext context, Widget page) => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final acc = ref.watch(accountProvider);
    final subs = ref.watch(subscriptionsProvider.select((s) => s.subscriptions.length));
    final c = acc.customer;
    final initials = c.name.trim().isEmpty ? '?' : c.name.trim().split(RegExp(r'\s+')).take(2).map((w) => w[0].toUpperCase()).join();

    return Scaffold(
      backgroundColor: Brand.surface,
      appBar: AppBar(title: const Text('Account'), automaticallyImplyLeading: false, backgroundColor: Brand.surface),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          // who you are
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Brand.accent, Color(0xFF3F55C6)], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.circular(22),
            ),
            child: acc.signedIn
                ? Row(children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: Colors.white,
                      child: Text(initials, style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900, color: Brand.accent)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(c.name.isEmpty ? 'Welcome' : c.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 2),
                        Text('+91 ${c.phone}', style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  ])
                : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Welcome to Gaia', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text('Sign in to order, subscribe and track deliveries on any phone.', style: TextStyle(color: Colors.white.withValues(alpha: 0.85), height: 1.4)),
                    const SizedBox(height: 14),
                    FilledButton(
                      onPressed: () => _go(context, const CustomerLoginScreen()),
                      style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: Brand.accent, minimumSize: const Size(190, 46)),
                      child: const Text('Sign in / Create account'),
                    ),
                  ]),
          ),
          if (acc.signedIn) ...[
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _Stat(value: '${acc.orders.length}', label: 'Orders', icon: Icons.receipt_long_outlined, onTap: () => _go(context, const OrdersScreen()))),
              const SizedBox(width: 12),
              Expanded(child: _Stat(value: '$subs', label: 'Subscriptions', icon: Icons.event_repeat_rounded, onTap: () => _go(context, const MyCalendarScreen()))),
            ]),
          ],
          const _Label('My account'),
          _Group(children: [
            _Row(icon: Icons.receipt_long_outlined, title: 'My orders', subtitle: 'Track and see past orders', onTap: () => _go(context, const OrdersScreen())),
            _Row(icon: Icons.calendar_month_outlined, title: 'Calendar & subscriptions', subtitle: 'Skip days, vacation, pause', onTap: () => _go(context, const MyCalendarScreen())),
            if (acc.signedIn && c.address.isNotEmpty)
              _Row(icon: Icons.location_on_outlined, title: 'Saved address', subtitle: c.address, onTap: null),
          ]),
          const _Label('Partners'),
          _Group(children: [
            _Row(icon: Icons.two_wheeler_rounded, title: 'Delivery partner', subtitle: 'Sign in to deliver orders', onTap: () => _go(context, const RiderLoginScreen())),
            _Row(icon: Icons.storefront_outlined, title: 'Distributor', subtitle: 'Sign in to place your orders', onTap: () => _go(context, const DistributorLoginScreen())),
          ]),
          const _Label('About'),
          _Group(children: [
            const _Row(icon: Icons.favorite_border_rounded, title: 'Gaia', subtitle: '$tagline · fresh dairy from Vamaa Dairy', onTap: null),
            _Row(icon: Icons.description_outlined, title: 'Licences', subtitle: 'Open-source software in this app', onTap: () => showLicensePage(context: context, applicationName: appName)),
          ]),
          if (acc.signedIn) ...[
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: () => _signOut(context, ref),
              style: OutlinedButton.styleFrom(foregroundColor: Brand.danger, side: const BorderSide(color: Color(0xFFF3C2BF)), minimumSize: const Size.fromHeight(50), backgroundColor: Colors.white),
              icon: const Icon(Icons.logout_rounded, size: 20),
              label: const Text('Sign out'),
            ),
          ],
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label, required this.icon, required this.onTap});
  final String value;
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => AppCard(
        onTap: onTap,
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          IconTile(icon, size: 40),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
            Text(label, style: const TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w600)),
          ]),
        ]),
      );
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 22, 4, 8),
        child: Text(text.toUpperCase(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Brand.muted, letterSpacing: 0.8)),
      );
}

/// Rows in one white card, separated by hairlines.
class _Group extends StatelessWidget {
  const _Group({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => AppCard(
        padding: EdgeInsets.zero,
        child: Column(children: [
          for (var i = 0; i < children.length; i++) ...[
            children[i],
            if (i < children.length - 1) const Padding(padding: EdgeInsets.only(left: 68), child: Divider()),
          ],
        ]),
      );
}

class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          child: Row(children: [
            IconTile(icon, size: 40),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                Text(subtitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Brand.muted, fontSize: 12.5, height: 1.3)),
              ]),
            ),
            if (onTap != null) const Icon(Icons.chevron_right_rounded, color: Brand.faint),
          ]),
        ),
      );
}
