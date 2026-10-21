import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../models.dart';
import '../store/account.dart';
import '../store/catalog.dart';
import '../store/subscriptions.dart';
import '../subscription_widgets.dart';
import '../theme.dart';
import '../widgets.dart';
import 'subscribe_screen.dart';

void _toast(BuildContext context, String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

/// Runs a subscription change and says what went wrong, if anything.
Future<bool> _try(BuildContext context, Future<void> Function() run) async {
  try {
    await run();
    return true;
  } on ApiException catch (e) {
    if (context.mounted) _toast(context, e.message);
  } catch (_) {
    if (context.mounted) _toast(context, 'Something went wrong. Please try again.');
  }
  return false;
}

/// Pick a product to subscribe to.
Future<void> pickProductToSubscribe(BuildContext context, WidgetRef ref) async {
  final products = ref.read(catalogProvider).products;
  final p = await showModalBottomSheet<Product>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (c) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.92,
      builder: (c, scroll) => ListView(
        controller: scroll,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          const Text('Subscribe to', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          const Text('Choose a product - then how often and from which day.', style: TextStyle(color: Brand.muted)),
          const SizedBox(height: 12),
          for (final p in products)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: ProductImage(url: p.image, size: 48, radius: 10, fit: BoxFit.contain),
              title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(rupees(p.price)),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.pop(c, p),
            ),
        ],
      ),
    ),
  );
  if (p != null && context.mounted) Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SubscribeScreen(product: p)));
}

/// Vacation: no deliveries between two dates.
Future<void> setVacation(BuildContext context, WidgetRef ref) async {
  final first = firstEditableLocal();
  final range = await showDateRangePicker(
    context: context,
    firstDate: first,
    lastDate: first.add(const Duration(days: 120)),
    helpText: 'Vacation - no deliveries',
    saveText: 'Set vacation',
  );
  if (range == null || !context.mounted) return;
  late int days;
  final ok = await _try(context, () async => days = await ref.read(subscriptionsProvider.notifier).vacation(range.start, range.end));
  if (ok && context.mounted) _toast(context, 'Vacation set: no deliveries on $days day${days == 1 ? '' : 's'}.');
}

/// One day: what comes, change a quantity, skip it, or bring it back.
Future<void> showDaySheet(BuildContext context, DateTime day) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _DaySheet(day: day),
    );

class _DaySheet extends ConsumerStatefulWidget {
  const _DaySheet({required this.day});
  final DateTime day;

  @override
  ConsumerState<_DaySheet> createState() => _DaySheetState();
}

class _DaySheetState extends ConsumerState<_DaySheet> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() f) async {
    setState(() => _busy = true);
    await _try(context, f);
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final subs = ref.watch(subscriptionsProvider);
    final d = subs.on(widget.day);
    final store = ref.read(subscriptionsProvider.notifier);
    final items = d?.items ?? const <SubItem>[];
    final kind = d?.kind ?? DayKind.none;
    final editable = d?.editable ?? false;
    final hasPlan = items.any((i) => i.planQty > 0);

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.paddingOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(child: Text(niceDate(widget.day), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: DayColors.of(kind).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
              child: Text(
                switch (kind) { DayKind.vacation => 'Vacation', DayKind.delivered => 'Delivered', DayKind.upcoming => d?.state == 'ordered' ? 'On its way' : 'Upcoming', DayKind.none => 'No delivery' },
                style: TextStyle(color: DayColors.of(kind), fontWeight: FontWeight.w800, fontSize: 12.5),
              ),
            ),
          ]),
          if (d?.orderNo != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Order ${d!.orderNo}', style: const TextStyle(color: Brand.muted))),
          const SizedBox(height: 14),
          if (items.isEmpty)
            const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Nothing is scheduled for this day.', style: TextStyle(color: Brand.muted))),
          for (final i in items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(children: [
                ProductImage(url: i.image, size: 46, radius: 10, fit: BoxFit.contain),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(i.name, style: TextStyle(fontWeight: FontWeight.w700, decoration: i.qty == 0 ? TextDecoration.lineThrough : null)),
                    Text(i.qty == 0 ? 'Skipped' : (i.changed ? 'Changed from ${i.planQty}' : 'As planned'),
                        style: TextStyle(fontSize: 12.5, color: i.qty == 0 ? DayColors.vacation : Brand.muted)),
                  ]),
                ),
                if (editable)
                  QtyStepper(value: i.qty, min: 0, onChanged: _busy ? (_) {} : (v) => _run(() => store.setDay(i.subscriptionId, widget.day, v == i.planQty ? null : v)))
                else
                  Text('× ${i.qty}', style: const TextStyle(fontWeight: FontWeight.w900)),
              ]),
            ),
          const SizedBox(height: 14),
          if (!editable)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(12)),
              child: Text(
                d?.state == 'ordered' ? 'This day is already on its way, so it can no longer be changed.' : 'Changes close at 9 PM the evening before.',
                style: const TextStyle(color: Brand.muted),
              ),
            )
          else if (hasPlan || kind == DayKind.vacation)
            SizedBox(
              width: double.infinity,
              child: kind == DayKind.vacation
                  ? FilledButton.icon(
                      onPressed: _busy ? null : () => _run(() => store.skipDay(widget.day, false)),
                      style: FilledButton.styleFrom(backgroundColor: DayColors.delivered),
                      icon: const Icon(Icons.replay),
                      label: const Text('Deliver on this day'),
                    )
                  : OutlinedButton.icon(
                      onPressed: _busy ? null : () => _run(() => store.skipDay(widget.day, true)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: DayColors.vacation,
                        minimumSize: const Size.fromHeight(50),
                        side: const BorderSide(color: DayColors.vacation),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      icon: const Icon(Icons.event_busy),
                      label: const Text('Skip this whole day'),
                    ),
            ),
        ],
      ),
    );
  }
}

/// The home strip: a fortnight of day chips with coloured dots, Set Vacation and My Calendar,
/// and what the chosen day holds.
class QuickCalendar extends ConsumerStatefulWidget {
  const QuickCalendar({super.key});

  @override
  ConsumerState<QuickCalendar> createState() => _QuickCalendarState();
}

class _QuickCalendarState extends ConsumerState<QuickCalendar> {
  late DateTime _picked = firstEditableLocal();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(subscriptionsProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = ref.watch(accountProvider.select((a) => a.signedIn));
    final subs = ref.watch(subscriptionsProvider);

    final today = dayOnly(DateTime.now());
    final days = [for (var i = -2; i < 14; i++) DateTime(today.year, today.month, today.day + i)];
    final sel = subs.on(_picked);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          // shrinks rather than cuts off when the phone's text size is large
          const Expanded(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text('Quick Calendar', maxLines: 1, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            ),
          ),
          const SizedBox(width: 8),
          if (signedIn && subs.hasAny) ...[
            _Pill(icon: Icons.beach_access_outlined, label: 'Vacation', dark: false, onTap: () => setVacation(context, ref)),
            const SizedBox(width: 6),
          ],
          _Pill(
            icon: Icons.calendar_month,
            label: 'My calendar',
            dark: true,
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const MyCalendarScreen())),
          ),
        ]),
        const SizedBox(height: 12),
        SizedBox(
          height: 66,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: days.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (_, i) {
              final d = days[i];
              final info = subs.on(d);
              final on = sameDay(d, _picked);
              return GestureDetector(
                onTap: () => setState(() => _picked = d),
                child: Container(
                  width: 50,
                  decoration: BoxDecoration(
                    color: on ? Colors.white : Brand.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: on ? Brand.ink : Colors.transparent, width: 1.4),
                  ),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text('${d.day}', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: sameDay(d, today) ? Brand.accent : Brand.ink)),
                    Text(weekdayShort[d.weekday - 1].toUpperCase(), style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Brand.muted)),
                    const SizedBox(height: 3),
                    Container(width: 6, height: 6, decoration: BoxDecoration(color: DayColors.of(info?.kind ?? DayKind.none), shape: BoxShape.circle)),
                  ]),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 10),
        const DayLegend(),
        const SizedBox(height: 10),
        // what the chosen day holds
        // no subscriptions: just the strip and legend, nothing more
        if (!signedIn || !subs.hasAny)
          const SizedBox.shrink()
        else if (sel == null || sel.count == 0)
          Container(
            padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
            decoration: BoxDecoration(color: const Color(0xFFFBE9E9), borderRadius: BorderRadius.circular(24)),
            child: Row(children: [
              Expanded(
                child: Text(
                  sel?.kind == DayKind.vacation ? 'Vacation on ${niceDate(_picked)} - no delivery' : 'No product is scheduled for ${niceDate(_picked)}',
                  style: const TextStyle(fontSize: 13, color: Brand.ink),
                ),
              ),
              if (sel?.editable ?? false)
                FilledButton(
                  onPressed: () => sel?.kind == DayKind.vacation ? showDaySheet(context, _picked) : pickProductToSubscribe(context, ref),
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 36), padding: const EdgeInsets.symmetric(horizontal: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))),
                  child: Text(sel?.kind == DayKind.vacation ? 'BRING BACK' : '+ ADD ITEM', style: const TextStyle(fontSize: 12.5)),
                ),
            ]),
          )
        else
          Material(
            color: Brand.surface,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => showDaySheet(context, _picked),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  for (final i in sel.items.where((i) => i.qty > 0).take(3))
                    Padding(padding: const EdgeInsets.only(right: 6), child: ProductImage(url: i.image, size: 38, radius: 8, fit: BoxFit.contain)),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      sel.items.where((i) => i.qty > 0).map((i) => '${i.name} × ${i.qty}').join(', '),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                  ),
                  Text(sel.editable ? 'Edit' : 'View', style: const TextStyle(color: Brand.accent, fontWeight: FontWeight.w800)),
                ]),
              ),
            ),
          ),
      ]),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.icon, required this.label, required this.dark, required this.onTap});
  final IconData icon;
  final String label;
  final bool dark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: dark ? Brand.accent : const Color(0xFF5F6670),
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon, size: 14, color: Colors.white),
              const SizedBox(width: 4),
              Text(label, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
            ]),
          ),
        ),
      );
}

/// The month: every day coloured as in the legend (tap to change it), and the subscriptions themselves.
class MyCalendarScreen extends ConsumerStatefulWidget {
  const MyCalendarScreen({super.key});

  @override
  ConsumerState<MyCalendarScreen> createState() => _MyCalendarScreenState();
}

class _MyCalendarScreenState extends ConsumerState<MyCalendarScreen> {
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(subscriptionsProvider.notifier).load();
    });
  }

  Future<void> _editQty(Subscription s) async {
    var q = s.qty;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(s.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            const Text('Quantity on every delivery from now on', style: TextStyle(color: Brand.muted)),
            const SizedBox(height: 16),
            QtyStepper(value: q, onChanged: (v) => set(() => q = v)),
            const SizedBox(height: 20),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Save')),
          ]),
        ),
      ),
    );
    if (ok == true && q != s.qty && mounted) await _try(context, () => ref.read(subscriptionsProvider.notifier).setQty(s.id, q));
  }

  Future<void> _cancel(Subscription s) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Stop this subscription?'),
        content: Text('${s.name} will no longer be delivered. Days already on their way are not affected.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Keep it')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Stop', style: TextStyle(color: DayColors.vacation))),
        ],
      ),
    );
    if (ok == true && mounted) await _try(context, () => ref.read(subscriptionsProvider.notifier).cancel(s.id));
  }

  @override
  Widget build(BuildContext context) {
    final subs = ref.watch(subscriptionsProvider);
    final store = ref.read(subscriptionsProvider.notifier);
    final today = dayOnly(DateTime.now());
    final earliest = SubscriptionStore.windowStart;

    Widget band() => Container(height: 8, color: Brand.surface);
    final canBack = _month.isAfter(earliest);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        titleSpacing: Navigator.of(context).canPop() ? 0 : 20,
        title: const Text('Calendar', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: OutlinedButton.icon(
              onPressed: () => setVacation(context, ref),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 38),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                shape: const StadiumBorder(),
                side: const BorderSide(color: Brand.line),
                foregroundColor: Brand.ink,
              ),
              icon: const Icon(Icons.beach_access_outlined, size: 18),
              label: const Text('Vacation', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider()),
      ),
      body: RefreshIndicator(
        color: Brand.accent,
        onRefresh: store.load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            // month title on the left, arrows on the right
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 12, 10),
              child: Row(children: [
                Expanded(
                  child: Text('${monthNames[_month.month - 1]} ${_month.year}',
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -0.3)),
                ),
                _Arrow(icon: Icons.chevron_left_rounded, onTap: canBack ? () => setState(() => _month = DateTime(_month.year, _month.month - 1)) : null),
                const SizedBox(width: 8),
                _Arrow(icon: Icons.chevron_right_rounded, onTap: () => setState(() => _month = DateTime(_month.year, _month.month + 1))),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: MonthGrid(
                month: _month,
                cell: (d) {
                  final kind = subs.on(d)?.kind ?? DayKind.none;
                  final isToday = sameDay(d, today);
                  final past = d.isBefore(today);
                  return InkWell(
                    customBorder: const CircleBorder(),
                    onTap: () => showDaySheet(context, d),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Container(
                        width: 34,
                        height: 34,
                        alignment: Alignment.center,
                        decoration: isToday ? const BoxDecoration(color: Brand.ink, shape: BoxShape.circle) : null,
                        child: Text(
                          '${d.day}',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: isToday ? FontWeight.w800 : FontWeight.w600,
                            color: isToday ? Colors.white : (past ? Brand.faint : Brand.ink),
                          ),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Container(
                        width: 5,
                        height: 5,
                        decoration: BoxDecoration(
                          color: kind == DayKind.none ? Colors.transparent : DayColors.of(kind).withValues(alpha: past ? 0.5 : 1),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ]),
                  );
                },
              ),
            ),
            const Padding(padding: EdgeInsets.fromLTRB(20, 14, 20, 0), child: DayLegend()),
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: Text('Tap a day to skip it or change the quantity. Changes close at 9 PM the evening before.',
                  style: TextStyle(fontSize: 13, color: Brand.muted, height: 1.4)),
            ),
            band(),
            // what comes, how often
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 8, 4),
              child: Row(children: [
                const Expanded(child: Text('Your subscriptions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800))),
                TextButton.icon(
                  onPressed: () => pickProductToSubscribe(context, ref),
                  icon: const Icon(Icons.add_rounded, size: 20),
                  label: const Text('Add', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ]),
            ),
            if (subs.subscriptions.isEmpty)
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 8, 20, 24),
                child: Text('Nothing yet. Subscribe to milk, curd or paneer and it comes every morning on the days you choose.',
                    style: TextStyle(color: Brand.muted, height: 1.4)),
              ),
            for (final (i, s) in subs.subscriptions.indexed) ...[
              if (i > 0) const Padding(padding: EdgeInsets.symmetric(horizontal: 20), child: Divider()),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      width: 56,
                      height: 56,
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(12)),
                      child: ProductImage(url: s.image, radius: 0, fit: BoxFit.contain),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(child: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                          if (s.paused) const Text('Paused', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Brand.muted)),
                        ]),
                        const SizedBox(height: 3),
                        Text('${s.qty} × ${s.plan.describe}', style: const TextStyle(color: Brand.ink, fontSize: 13.5)),
                        const SizedBox(height: 2),
                        Text(
                          'From ${niceDate(s.plan.start)}${s.plan.end != null ? ' to ${niceDate(s.plan.end!)}' : ''}',
                          style: const TextStyle(color: Brand.muted, fontSize: 12.5),
                        ),
                      ]),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    _Act(label: 'Quantity', onTap: () => _editQty(s)),
                    const SizedBox(width: 8),
                    _Act(label: s.paused ? 'Resume' : 'Pause', onTap: () => _try(context, () => store.pause(s.id, !s.paused))),
                    const SizedBox(width: 8),
                    _Act(label: 'Stop', color: Brand.danger, onTap: () => _cancel(s)),
                  ]),
                ]),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Small round outlined arrow for changing the month.
class _Arrow extends StatelessWidget {
  const _Arrow({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Brand.line)),
          child: Icon(icon, size: 22, color: onTap == null ? Brand.faint : Brand.ink),
        ),
      );
}

class _Act extends StatelessWidget {
  const _Act({required this.label, required this.onTap, this.color = Brand.ink});
  final String label;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) => Expanded(
        child: OutlinedButton(
          onPressed: onTap,
          style: OutlinedButton.styleFrom(
            foregroundColor: color,
            minimumSize: const Size(0, 38),
            padding: EdgeInsets.zero,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            side: const BorderSide(color: Brand.line),
          ),
          child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
        ),
      );
}
