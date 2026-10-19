import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../models.dart';
import '../store/account.dart';
import '../store/cart.dart';
import '../store/subscriptions.dart';
import '../subscription_widgets.dart';
import '../theme.dart';
import '../widgets.dart';
import 'address_picker_screen.dart';
import 'customer_login_screen.dart';
import 'my_calendar_screen.dart';

/// Buy once, or subscribe: quantity, how often (daily, alternate, chosen weekdays, every nth day,
/// all but every nth day), from which day, with a month preview where single days can be taken out.
class SubscribeScreen extends ConsumerStatefulWidget {
  const SubscribeScreen({super.key, required this.product});
  final Product product;

  @override
  ConsumerState<SubscribeScreen> createState() => _SubscribeScreenState();
}

class _SubscribeScreenState extends ConsumerState<SubscribeScreen> {
  bool _subscribe = true;
  int _qty = 1;
  Frequency _freq = Frequency.daily;
  List<int> _weekdays = const [1, 2, 3, 4, 5, 6];
  int _n = 3;
  late DateTime _start = firstEditableLocal();
  DateTime? _end;
  late DateTime _month = DateTime(_start.year, _start.month);
  final Set<DateTime> _removed = {};
  bool _busy = false;

  SubPlan get _plan => SubPlan(frequency: _freq, start: _start, end: _end, weekdays: _weekdays, everyN: _n);

  bool _isOn(DateTime d) => _plan.due(d) && !_removed.contains(dayOnly(d));

  /// How many deliveries and what they cost in the month on screen.
  (int, double) _monthTotal() {
    var n = 0;
    final days = DateTime(_month.year, _month.month + 1, 0).day;
    for (var i = 1; i <= days; i++) {
      if (_isOn(DateTime(_month.year, _month.month, i))) n++;
    }
    return (n, n * _qty * widget.product.price);
  }

  Future<void> _editWeekdays() async {
    final picked = {..._weekdays};
    final ok = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Deliver on', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 14),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (var w = 1; w <= 7; w++)
                PillChoice(label: weekdayShort[w - 1], selected: picked.contains(w), onTap: () => set(() => picked.contains(w) ? picked.remove(w) : picked.add(w))),
            ]),
            const SizedBox(height: 20),
            FilledButton(onPressed: picked.isEmpty ? null : () => Navigator.pop(c, true), child: const Text('Done')),
          ]),
        ),
      ),
    );
    if (ok == true) setState(() => _weekdays = (picked.toList()..sort()));
  }

  Future<void> _editN(Frequency f) async {
    var n = _n;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(f == Frequency.everyN ? 'Deliver every' : 'Skip every', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 14),
            Row(children: [
              QtyStepper(value: n, min: 2, max: 30, onChanged: (v) => set(() => n = v)),
              const SizedBox(width: 12),
              const Text('days', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 8),
            Text(
              f == Frequency.everyN ? 'One delivery, then $n days later the next.' : 'Delivered every day except every ${n}th day.',
              style: const TextStyle(color: Brand.muted),
            ),
            const SizedBox(height: 20),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Done')),
          ]),
        ),
      ),
    );
    if (ok == true) setState(() => _n = n);
  }

  Future<void> _pickStart() async {
    final first = firstEditableLocal();
    final d = await showDatePicker(context: context, initialDate: _start.isBefore(first) ? first : _start, firstDate: first, lastDate: first.add(const Duration(days: 120)));
    if (d != null) {
      setState(() {
        _start = d;
        _month = DateTime(d.year, d.month);
        _removed.removeWhere((x) => x.isBefore(d));
        if (_end != null && _end!.isBefore(d)) _end = null;
      });
    }
  }

  Future<void> _pickEnd() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _end ?? _start.add(const Duration(days: 29)),
      firstDate: _start,
      lastDate: _start.add(const Duration(days: 365)),
      helpText: 'Deliver until',
    );
    if (d != null) setState(() => _end = d);
  }

  Future<void> _confirm() async {
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    if (!_subscribe) {
      final cart = ref.read(cartProvider.notifier);
      for (var i = 0; i < _qty; i++) {
        cart.add(widget.product);
      }
      messenger.showSnackBar(SnackBar(content: Text('${widget.product.name} × $_qty added to cart')));
      nav.pop();
      return;
    }
    if (!await CustomerLoginScreen.ensure(context, reason: 'Sign in or create an account to start your subscription.')) return;
    var to = ref.read(accountProvider).customer;
    if (to.address.trim().length < 5) {
      if (!mounted) return;
      final picked = await Navigator.of(context).push<PickedLocation>(MaterialPageRoute(builder: (_) => const AddressPickerScreen()));
      if (picked == null) return;
      to = Customer(name: to.name, phone: to.phone, address: picked.address, pincode: picked.pincode ?? '', lat: picked.lat, lng: picked.lng);
    }
    setState(() => _busy = true);
    try {
      await ref.read(subscriptionsProvider.notifier).subscribe(product: widget.product, qty: _qty, plan: _plan, to: to, skipDays: _removed.toList());
      messenger.showSnackBar(const SnackBar(content: Text('Subscription started')));
      nav.pushReplacement(MaterialPageRoute<void>(builder: (_) => const MyCalendarScreen()));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Something went wrong. Please try again.')));
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final (count, cost) = _monthTotal();
    final first = firstEditableLocal();
    const label = TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Brand.ink);

    return Scaffold(
      appBar: AppBar(title: const Text('Subscription', style: TextStyle(fontWeight: FontWeight.w700))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          SizedBox(height: 180, child: ProductImage(url: p.image, radius: 0, fit: BoxFit.contain)),
          const SizedBox(height: 12),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                if (p.size != null) Text(p.size!, style: const TextStyle(color: Brand.muted)),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(rupees(p.price), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
              const Text('(inclusive of all taxes)', style: TextStyle(fontSize: 11.5, color: Brand.muted)),
            ]),
          ]),
          const Divider(height: 28),
          const Text('Subscription Type', style: label),
          const SizedBox(height: 10),
          Wrap(spacing: 8, children: [
            PillChoice(label: 'One time', selected: !_subscribe, onTap: () => setState(() => _subscribe = false)),
            PillChoice(label: 'Subscription', selected: _subscribe, onTap: () => setState(() => _subscribe = true)),
          ]),
          const SizedBox(height: 18),
          Row(children: [
            const Expanded(child: Text('Quantity', style: label)),
            QtyStepper(value: _qty, onChanged: (v) => setState(() => _qty = v)),
          ]),
          if (_subscribe) ...[
            const SizedBox(height: 18),
            const Text('Frequency', style: label),
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 10, children: [
              PillChoice(label: 'Daily', selected: _freq == Frequency.daily, onTap: () => setState(() => _freq = Frequency.daily)),
              PillChoice(label: 'Alternate', selected: _freq == Frequency.alternate, onTap: () => setState(() => _freq = Frequency.alternate)),
              PillChoice(
                label: _freq == Frequency.weekdays ? 'Custom · ${_plan.describe}' : 'Custom',
                selected: _freq == Frequency.weekdays,
                editable: true,
                onTap: () async {
                  setState(() => _freq = Frequency.weekdays);
                  await _editWeekdays();
                },
              ),
              PillChoice(
                label: _freq == Frequency.everyN ? 'Every $_n days' : 'Every nth day',
                selected: _freq == Frequency.everyN,
                editable: true,
                onTap: () async {
                  setState(() => _freq = Frequency.everyN);
                  await _editN(Frequency.everyN);
                },
              ),
              PillChoice(
                label: _freq == Frequency.skipN ? "Don't deliver every ${_n}th day" : "Don't deliver on nth day",
                selected: _freq == Frequency.skipN,
                editable: true,
                onTap: () async {
                  setState(() => _freq = Frequency.skipN);
                  await _editN(Frequency.skipN);
                },
              ),
            ]),
            const SizedBox(height: 20),
            Row(children: [
              const Expanded(child: Text('Calendar Preview', style: label)),
              Text('Tap a day to remove it', style: TextStyle(fontSize: 12, color: Brand.muted.withValues(alpha: 0.9))),
            ]),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 10),
              decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(16)),
              child: Column(children: [
                MonthHeader(
                  month: _month,
                  canGoBack: _month.isAfter(DateTime(first.year, first.month)),
                  onChange: (m) => setState(() => _month = m),
                ),
                MonthGrid(
                  month: _month,
                  cell: (d) {
                    final before = d.isBefore(_start);
                    final due = _plan.due(d);
                    final removed = _removed.contains(dayOnly(d));
                    final isStart = sameDay(d, _start);
                    return GestureDetector(
                      onTap: before || !due ? null : () => setState(() => removed ? _removed.remove(dayOnly(d)) : _removed.add(dayOnly(d))),
                      child: Container(
                        margin: const EdgeInsets.all(3),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: due && !removed && !before ? Brand.accent.withValues(alpha: 0.14) : null,
                          borderRadius: BorderRadius.circular(8),
                          border: isStart ? Border.all(color: DayColors.delivered, width: 1.6) : null,
                        ),
                        child: Text(
                          '${d.day}',
                          style: TextStyle(
                            fontWeight: due && !before ? FontWeight.w800 : FontWeight.w500,
                            color: before ? Brand.faint.withValues(alpha: 0.6) : removed ? DayColors.vacation : (due ? Brand.accent : Brand.ink),
                            decoration: removed ? TextDecoration.lineThrough : null,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ]),
            ),
            const SizedBox(height: 10),
            Text('$count deliveries in ${monthNames[_month.month - 1]} · about ${rupees(cost)}', style: const TextStyle(color: Brand.muted, fontWeight: FontWeight.w600)),
            const SizedBox(height: 18),
            Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Delivery Date', style: label),
                  const SizedBox(height: 8),
                  _DateChip(text: niceDate(_start), onTap: _pickStart),
                ]),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Until', style: label),
                  const SizedBox(height: 8),
                  _DateChip(text: _end == null ? 'No end date' : niceDate(_end!), onTap: _pickEnd, onClear: _end == null ? null : () => setState(() => _end = null)),
                ]),
              ),
            ]),
            const SizedBox(height: 10),
            const Text('Change, skip or pause any day later from My Calendar - until 9 PM the evening before.', style: TextStyle(fontSize: 12.5, color: Brand.muted)),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
          child: FilledButton(
            onPressed: _busy ? null : _confirm,
            style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28))),
            child: _busy
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                : Text(_subscribe ? 'CONFIRM SUBSCRIPTION' : 'ADD TO CART · ${rupees(p.price * _qty)}', style: const TextStyle(letterSpacing: 0.4)),
          ),
        ),
      ),
    );
  }
}

class _DateChip extends StatelessWidget {
  const _DateChip({required this.text, required this.onTap, this.onClear});
  final String text;
  final VoidCallback onTap;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          decoration: BoxDecoration(color: const Color(0xFFEDEFF3), borderRadius: BorderRadius.circular(22)),
          child: Row(children: [
            Expanded(child: Text(text, style: const TextStyle(fontWeight: FontWeight.w600, color: Brand.ink))),
            if (onClear != null)
              GestureDetector(onTap: onClear, child: const Icon(Icons.close, size: 16, color: Brand.muted))
            else
              const Icon(Icons.edit_outlined, size: 16, color: DayColors.vacation),
          ]),
        ),
      );
}
