import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../push.dart';
import 'account.dart';
import 'core.dart';
import 'distributor.dart';
import 'rider.dart';

/// Keeps the backend told which phone belongs to which signed-in session: whenever the push token
/// arrives or changes, or someone signs in, every signed-in role registers it. Watched once from
/// the app root; does nothing when Firebase is not set up.
final pushSyncProvider = Provider<void>((ref) {
  final customer = ref.watch(accountProvider.select((a) => a.signedIn));
  final rider = ref.watch(riderProvider.select((r) => r.signedIn));
  final distributor = ref.watch(distributorProvider.select((d) => d.signedIn));

  void register() {
    final t = Push.token;
    if (t == null) return;
    final vault = ref.read(vaultProvider), api = ref.read(apiProvider);
    for (final (signedIn, key) in [(customer, TokenVault.customer), (rider, TokenVault.rider), (distributor, TokenVault.distributor)]) {
      final session = vault.read(key);
      if (signedIn && session != null) unawaited(api.registerPushToken(session, t));
    }
  }

  register();
  final sub = Push.onToken.listen((_) => register());
  ref.onDispose(sub.cancel);
});
