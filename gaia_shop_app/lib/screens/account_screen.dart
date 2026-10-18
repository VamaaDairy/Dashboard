import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../state/orders_state.dart';
import '../theme.dart';
import 'customer_login_screen.dart';
import 'rider_login_screen.dart';

/// A quiet page: who we are, and the way in for delivery partners.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final orders = context.watch<OrdersState>();
    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
        children: [
          Image.asset('assets/images/gaia-logo.jpg', height: 84, alignment: Alignment.centerLeft, fit: BoxFit.contain),
          const SizedBox(height: 10),
          const Text(tagline, style: TextStyle(color: Brand.muted, fontWeight: FontWeight.w600)),
          const SizedBox(height: 28),
          Container(
            decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(16)),
            child: orders.signedIn
                ? ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    leading: const CircleAvatar(backgroundColor: Brand.accentTint, child: Icon(Icons.person, color: Brand.accent)),
                    title: Text(orders.customer.name.isEmpty ? 'Signed in' : orders.customer.name, style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text(orders.customer.phone),
                    trailing: TextButton(onPressed: orders.signOut, child: const Text('Sign out')),
                  )
                : ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    leading: const CircleAvatar(backgroundColor: Brand.accentTint, child: Icon(Icons.person_outline, color: Brand.accent)),
                    title: const Text('Sign in', style: TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: const Text('Mobile number and PIN - keep your orders on any phone'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CustomerLoginScreen())),
                  ),
          ),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(16)),
            child: ListTile(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              leading: const CircleAvatar(backgroundColor: Brand.accentTint, child: Icon(Icons.two_wheeler, color: Brand.accent)),
              title: const Text('Delivery partner', style: TextStyle(fontWeight: FontWeight.w800)),
              subtitle: const Text('Sign in to see and deliver your orders'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const RiderLoginScreen())),
            ),
          ),
        ],
      ),
    );
  }
}
