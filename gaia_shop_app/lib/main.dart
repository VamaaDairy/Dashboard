import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'config.dart';
import 'screens/home_screen.dart';
import 'screens/rider_home_screen.dart';
import 'state/cart_state.dart';
import 'state/catalog_state.dart';
import 'state/map_state.dart';
import 'state/orders_state.dart';
import 'state/rider_state.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SplashScreen());
  // keep the opening screen up for a beat even when startup is instant
  final minSplash = Future<void>.delayed(const Duration(milliseconds: 1500));
  // a startup failure should say what broke instead of leaving the launch logo up
  try {
    final prefs = await SharedPreferences.getInstance();
    await minSplash;
    runApp(GaiaApp(prefs: prefs));
  } catch (e, st) {
    runApp(MaterialApp(home: Scaffold(body: SafeArea(child: Padding(padding: const EdgeInsets.all(20), child: SingleChildScrollView(child: Text('Gaia could not start.\n\n$e\n\n$st')))))));
  }
}

/// Opening screen: the Gaia logo on the dairy doodle pattern.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Colors.white,
      child: Image(image: AssetImage('assets/images/splash.jpg'), fit: BoxFit.cover),
    );
  }
}

class GaiaApp extends StatelessWidget {
  const GaiaApp({super.key, required this.prefs, this.api});
  final SharedPreferences prefs;

  /// Swap in a fake backend for tests.
  final Api? api;

  @override
  Widget build(BuildContext context) {
    final backend = api ?? Api();
    return MultiProvider(
      providers: [
        Provider<Api>.value(value: backend),
        ChangeNotifierProvider(create: (_) => CatalogState(backend)),
        ChangeNotifierProvider(create: (_) => CartState(prefs)),
        ChangeNotifierProvider(create: (_) => OrdersState(backend, prefs)),
        ChangeNotifierProvider(create: (_) => MapState(backend)),
        ChangeNotifierProvider(create: (_) => RiderState(backend, prefs)),
      ],
      child: MaterialApp(
        title: appName,
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        // a signed-in delivery partner opens straight on their deliveries
        home: Consumer<RiderState>(builder: (_, rider, __) => rider.signedIn ? const RiderHomeScreen() : const HomeShell()),
      ),
    );
  }
}
