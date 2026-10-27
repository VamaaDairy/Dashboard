import 'package:flutter/material.dart';

import '../theme.dart';
import 'rider_account_screen.dart';
import 'rider_history_screen.dart';
import 'rider_home_screen.dart';

/// What a signed-in delivery partner sees: three sections along the bottom. Add a new section by adding
/// a page and a destination here.
class RiderShell extends StatefulWidget {
  const RiderShell({super.key});

  @override
  State<RiderShell> createState() => _RiderShellState();
}

class _RiderShellState extends State<RiderShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _tab, children: const [
        RiderHomeScreen(),
        RiderHistoryScreen(),
        RiderAccountScreen(),
      ]),
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: Brand.line))),
        child: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: (i) => setState(() => _tab = i),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.local_shipping_outlined), selectedIcon: Icon(Icons.local_shipping), label: 'Deliveries'),
            NavigationDestination(icon: Icon(Icons.history), selectedIcon: Icon(Icons.history), label: 'History'),
            NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Account'),
          ],
        ),
      ),
    );
  }
}
