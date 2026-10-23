import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'config.dart';
import 'push.dart';
import 'screens/home_screen.dart';
import 'screens/rider_home_screen.dart';
import 'store/core.dart';
import 'store/push.dart';
import 'store/rider.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // the bundled typeface's licence shows in the app's licences page
  LicenseRegistry.addLicense(() async* {
    yield LicenseEntryWithLineBreaks(['Plus Jakarta Sans'], await rootBundle.loadString('assets/fonts/PlusJakartaSans-OFL.txt'));
  });
  runApp(const SplashScreen());
  // notifications come up alongside; the permission prompt must not hold the app up
  unawaited(Push.init());
  // keep the opening screen up for a beat even when startup is instant
  final minSplash = Future<void>.delayed(const Duration(milliseconds: 1500));
  // a startup failure should say what broke instead of leaving the launch logo up
  try {
    final prefs = await SharedPreferences.getInstance();
    final vault = await TokenVault.open(prefs);
    await minSplash;
    runApp(GaiaApp(prefs: prefs, vault: vault));
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

/// The app's stores (Riverpod) wrap everything; prefs and tokens are opened before it starts so
/// every store restores instantly.
class GaiaApp extends StatelessWidget {
  const GaiaApp({super.key, required this.prefs, required this.vault, this.api});
  final SharedPreferences prefs;
  final TokenVault vault;

  /// Swap in a fake backend for tests.
  final Api? api;

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: [
        prefsProvider.overrideWithValue(prefs),
        vaultProvider.overrideWithValue(vault),
        if (api != null) apiProvider.overrideWithValue(api!),
      ],
      child: MaterialApp(
        title: appName,
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        // registers this phone's push token for whoever is signed in
        builder: (context, child) => Consumer(builder: (_, ref, __) {
          ref.watch(pushSyncProvider);
          return child ?? const SizedBox.shrink();
        }),
        // a signed-in delivery partner opens straight on their deliveries
        home: Consumer(builder: (_, ref, __) {
          if (ref.watch(riderProvider.select((r) => r.signedIn))) return const RiderHomeScreen();
          return const HomeShell();
        }),
      ),
    );
  }
}
