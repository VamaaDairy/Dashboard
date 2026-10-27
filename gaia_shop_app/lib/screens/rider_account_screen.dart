import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../store/rider.dart';
import '../theme.dart';
import 'rider_ui.dart';

/// The delivery partner's profile, whether location is being shared, and sign out.
class RiderAccountScreen extends ConsumerWidget {
  const RiderAccountScreen({super.key});

  Future<void> _signOut(BuildContext context, RiderStore rider) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You will stop sharing your location and receiving deliveries on this phone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Sign out')),
        ],
      ),
    );
    if (ok == true) await rider.logout();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rider = ref.watch(riderProvider);
    final actions = ref.read(riderProvider.notifier);
    final sharing = rider.locationProblem == null;

    return Scaffold(
      backgroundColor: Brand.surface,
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          const SectionLabel('Delivery partner'),
          RiderPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(rider.profile?.name ?? '', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(rider.profile?.phone ?? '', style: const TextStyle(color: Brand.muted)),
              ],
            ),
          ),
          const SectionLabel('Location'),
          RiderPanel(
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(sharing ? 'Sharing location' : 'Location off', style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(sharing ? 'Customers can see you on the map while you deliver.' : rider.locationProblem!, style: const TextStyle(fontSize: 13.5, color: Brand.muted, height: 1.3)),
                ]),
              ),
              if (!sharing) TextButton(onPressed: actions.startSharing, child: const Text('Turn on')),
            ]),
          ),
          const SizedBox(height: 24),
          OutlinedButton(
            onPressed: () => _signOut(context, actions),
            style: riderOutlined().copyWith(foregroundColor: const WidgetStatePropertyAll(Brand.danger)),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}
