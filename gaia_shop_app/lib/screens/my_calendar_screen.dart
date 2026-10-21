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
          const Expanded(child: Text('Quick Calendar', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800))),
          if (signedIn && subs.hasAny) ...[
            _Pill(icon: Icons.beach_access_outlined, label: 'Set Vacation', dark: false, onTap: () => setVacation(context, ref)),
            const SizedBox(width: 6),
          ],
          _Pill(
            icon: Icons.calendar_month,
            label: 'MY CALENDAR',
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

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('My Calendar', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          TextButton.icon(onPressed: () => setVacation(context, ref), icon: const Icon(Icons.beach_access_outlined, size: 18), label: const Text('Vacation')),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        color: Brand.accent,
        onRefresh: store.load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 12),
              decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(18)),
              child: Column(children: [
                MonthHeader(month: _month, canGoBack: _month.isAfter(earliest), onChange: (m) => setState(() => _month = m)),
                MonthGrid(
                  month: _month,
                  cell: (d) {
                    final info = subs.on(d);
                    final kind = info?.kind ?? DayKind.none;
                    final isToday = sameDay(d, today);
                    return GestureDetector(
                      onTap: () => showDaySheet(context, d),
                      child: Container(
                        margin: const EdgeInsets.all(3),
                        decoration: BoxDecoration(
                          color: kind == DayKind.none ? null : DayColors.of(kind).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                          border: isToday ? Border.all(color: Brand.ink, width: 1.4) : null,
                        ),
                        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Text('${d.day}', style: TextStyle(fontWeight: FontWeight.w800, color: d.isBefore(today) ? Brand.faint : Brand.ink)),
                          const SizedBox(height: 2),
                          if (kind != DayKind.none)
                            Text(kind == DayKind.vacation ? 'off' : '${info!.count}',
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: DayColors.of(kind)))
                          else
                            const SizedBox(height: 12),
                        ]),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 8),
                const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: DayLegend()),
              ]),
            ),
            const SizedBox(height: 8),
            const Text('Tap a day to skip it or change the quantity. Changes close at 9 PM the evening before.',
                style: TextStyle(fontSize: 12.5, color: Brand.muted)),
            const SizedBox(height: 22),
            Row(children: [
              const Expanded(child: Text('Your subscriptions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
              TextButton.icon(onPressed: () => pickProductToSubscribe(context, ref), icon: const Icon(Icons.add), label: const Text('Add')),
            ]),
            if (subs.subscriptions.isEmpty)
              const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: Text('No subscriptions yet.', style: TextStyle(color: Brand.muted)))),
            for (final s in subs.subscriptions)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(16)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    ProductImage(url: s.image, size: 52, radius: 10, fit: BoxFit.contain),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(s.name, style: const TextStyle(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 2),
                        Text('${s.qty} × · ${s.plan.describe}', style: const TextStyle(color: Brand.muted, fontSize: 13)),
                        Text(
                          'From ${niceDate(s.plan.start)}${s.plan.end != null ? ' to ${niceDate(s.plan.end!)}' : ''}',
                          style: const TextStyle(color: Brand.faint, fontSize: 12),
                        ),
                      ]),
                    ),
                    if (s.paused)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: DayColors.none.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
                        child: const Text('Paused', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: DayColors.none)),
                      ),
                  ]),
                  const SizedBox(height: 10),
                  Row(children: [
                    _Act(icon: Icons.edit_outlined, label: 'Quantity', onTap: () => _editQty(s)),
                    _Act(
                      icon: s.paused ? Icons.play_arrow_rounded : Icons.pause_rounded,
                      label: s.paused ? 'Resume' : 'Pause',
                      onTap: () => _try(context, () => store.pause(s.id, !s.paused)),
                    ),
                    _Act(icon: Icons.close_rounded, label: 'Stop', color: DayColors.vacation, onTap: () => _cancel(s)),
                  ]),
                ]),
              ),
          ],
        ),
      ),
    );
  }
}

class _Act extends StatelessWidget {
  const _Act({required this.icon, required this.label, required this.onTap, this.color = Brand.accent});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) => Expanded(
        child: TextButton.icon(
          onPressed: onTap,
          style: TextButton.styleFrom(foregroundColor: color),
          icon: Icon(icon, size: 18),
          label: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
      );
}
