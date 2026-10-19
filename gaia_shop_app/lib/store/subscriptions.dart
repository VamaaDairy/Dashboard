import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../models.dart';
import 'account.dart';
import 'core.dart';

/// The customer's subscriptions and their calendar (from a month back to four months ahead).
/// Persisted, so the home Quick Calendar shows at once; refreshed after every change.
class SubState {
  const SubState({this.calendar, this.loading = false, this.error});
  final SubCalendar? calendar;
  final bool loading;
  final String? error;

  List<Subscription> get subscriptions => calendar?.subscriptions ?? const [];
  bool get hasAny => subscriptions.isNotEmpty;
  SubDay? on(DateTime d) => calendar?.on(d);
}

final subscriptionsProvider = NotifierProvider<SubscriptionStore, SubState>(SubscriptionStore.new);

class SubscriptionStore extends Notifier<SubState> {
  static const _key = 'gaia_subscriptions_v1';

  Api get _api => ref.read(apiProvider);
  String? get _token => ref.read(vaultProvider).read(TokenVault.customer);

  /// The window kept: from the 1st of last month, 150 days.
  static DateTime get windowStart {
    final n = DateTime.now();
    return DateTime(n.year, n.month - 1, 1);
  }

  @override
  SubState build() {
    // signing out empties it; signing in loads it
    ref.listen(accountProvider.select((a) => a.signedIn), (was, now) {
      if (now) {
        load();
      } else {
        ref.read(prefsProvider).remove(_key);
        state = const SubState();
      }
    });
    if (_token == null) return const SubState();
    try {
      final raw = ref.read(prefsProvider).getString(_key);
      if (raw != null) return SubState(calendar: SubCalendar.fromJson(jsonDecode(raw) as Map<String, dynamic>));
    } catch (_) {}
    return const SubState();
  }

  Future<void> load() async {
    await Future<void>.delayed(Duration.zero); // never change state in the middle of a build
    final t = _token;
    if (t == null || state.loading) return;
    state = SubState(calendar: state.calendar, loading: true);
    try {
      final raw = await _api.subscriptionsRaw(t, windowStart, 150);
      await ref.read(prefsProvider).setString(_key, raw);
      state = SubState(calendar: SubCalendar.fromJson(jsonDecode(raw) as Map<String, dynamic>));
    } on ApiException catch (e) {
      state = SubState(calendar: state.calendar, error: state.calendar == null ? e.message : null);
    } catch (_) {
      state = SubState(calendar: state.calendar);
    }
  }

  /// Runs a change, then reloads. Throws [ApiException] with a message to show.
  Future<T> _change<T>(Future<T> Function(String token) run) async {
    final t = _token;
    if (t == null) throw ApiException('Please sign in or create an account to subscribe.');
    final r = await run(t);
    await load();
    return r;
  }

  Future<int> subscribe({required Product product, required int qty, required SubPlan plan, required Customer to, List<DateTime> skipDays = const []}) =>
      _change((t) => _api.createSubscription(t, sku: product.sku, qty: qty, plan: plan, to: to, skipDays: skipDays));

  Future<void> setQty(int id, int qty) => _change((t) => _api.updateSubscription(t, id, {'qty': qty}));
  Future<void> setPlan(int id, SubPlan plan) => _change((t) => _api.updateSubscription(t, id, {
        'frequency': plan.frequency.api,
        'weekdays': plan.weekdays,
        'everyN': plan.everyN,
        'endDate': plan.end == null ? null : ymd(plan.end!),
      }));
  Future<void> pause(int id, bool pause) => _change((t) => _api.updateSubscription(t, id, {'status': pause ? 'paused' : 'active'}));
  Future<void> cancel(int id) => _change((t) => _api.updateSubscription(t, id, {'status': 'cancelled'}));

  /// One item on one day: 0 skips it, null goes back to the plan.
  Future<void> setDay(int id, DateTime day, int? qty) => _change((t) => _api.setSubscriptionDay(t, id, day, qty));
  Future<void> skipDay(DateTime day, bool skip) => _change((t) => _api.setWholeDay(t, day, skip));
  Future<int> vacation(DateTime from, DateTime to, {bool skip = true}) => _change((t) => _api.setVacation(t, from, to, skip: skip));
}
