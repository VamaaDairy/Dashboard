import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../push.dart';
import 'core.dart';
import 'distributor.dart';

/// Keeps the backend told which phone belongs to the signed-in session: whenever the push token
/// arrives or changes, or someone signs in, it is registered. Watched once from the app root;
/// does nothing when Firebase is not set up.
final pushSyncProvider = Provider<void>((ref) {
  final signedIn = ref.watch(distributorProvider.select((d) => d.signedIn));

  void register() {
    final t = Push.token;
    if (t == null) return;
    final session = ref.read(vaultProvider).read(TokenVault.distributor);
    if (signedIn && session != null) unawaited(ref.read(apiProvider).registerPushToken(session, t));
  }

  register();
  final sub = Push.onToken.listen((_) => register());
  ref.onDispose(sub.cancel);
});
