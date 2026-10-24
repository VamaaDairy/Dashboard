import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api.dart';
import '../models.dart';
import '../store/account.dart';
import '../store/cart.dart';
import '../store/subscriptions.dart';
import '../subscription_widgets.dart';
import '../theme.dart';
import '../ui.dart';
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

    Widget band() => Container(height: 8, color: Brand.surface);
    Widget title(String t) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 6),
          child: Text(t, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        );
    // one radio row per frequency; the ones with a number or days show what is chosen and "Change"
    Widget freq(Frequency f, String name, {String? detail, Future<void> Function()? edit}) {
      final on = _freq == f;
      return InkWell(
        onTap: () async {
          setState(() => _freq = f);
          if (edit != null) await edit();
        },
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 16, 12),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, style: TextStyle(fontSize: 15, fontWeight: on ? FontWeight.w700 : FontWeight.w500)),
                if (on && detail != null) ...[
                  const SizedBox(height: 2),
                  Text(detail, style: const TextStyle(fontSize: 13, color: Brand.muted)),
                ],
              ]),
            ),
            if (on && edit != null)
              TextButton(onPressed: edit, style: TextButton.styleFrom(visualDensity: VisualDensity.compact), child: const Text('Change')),
            Icon(on ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded, color: on ? Brand.accent : Brand.faint, size: 22),
          ]),
        ),
      );
    }

    Widget dateRow(String k, String v, VoidCallback onTap, {VoidCallback? onClear}) => InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 13, 16, 13),
            child: Row(children: [
              Expanded(child: Text(k, style: const TextStyle(fontSize: 15, color: Brand.muted))),
              Text(v, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              const SizedBox(width: 4),
              if (onClear != null)
                InkWell(onTap: onClear, customBorder: const CircleBorder(), child: const Padding(padding: EdgeInsets.all(2), child: Icon(Icons.close_rounded, size: 20, color: Brand.muted)))
              else
                const Icon(Icons.chevron_right_rounded, size: 22, color: Brand.faint),
            ]),
          ),
        );

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        titleSpacing: 0,
        title: const Text('Subscribe', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider()),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          // the product
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
            child: Row(children: [
              Container(
                width: 76,
                height: 76,
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: Colors.white, border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(14)),
                child: ProductImage(url: p.image, radius: 0, fit: BoxFit.contain),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, height: 1.25)),
                  if (p.size != null) ...[const SizedBox(height: 2), Text(p.size!, style: const TextStyle(color: Brand.muted, fontSize: 13))],
                  const SizedBox(height: 6),
                  Text(rupees(p.price), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                ]),
              ),
            ]),
          ),
          // once or regularly, and how many
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _Segment(
              options: const ['Subscribe', 'Buy once'],
              selected: _subscribe ? 0 : 1,
              onChanged: (i) => setState(() => _subscribe = i == 0),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Quantity', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  Text(_subscribe ? 'On every delivery' : 'Added to your cart', style: const TextStyle(fontSize: 13, color: Brand.muted)),
                ]),
              ),
              QtyStepper(value: _qty, onChanged: (v) => setState(() => _qty = v)),
            ]),
          ),
          if (_subscribe) ...[
            band(),
            title('How often'),
            freq(Frequency.daily, 'Daily'),
            freq(Frequency.alternate, 'Alternate days'),
            freq(Frequency.weekdays, 'Choose days', detail: SubPlan(frequency: Frequency.weekdays, start: _start, weekdays: _weekdays, everyN: _n).describe, edit: _editWeekdays),
            freq(Frequency.everyN, 'Every few days', detail: 'Every $_n days', edit: () => _editN(Frequency.everyN)),
            freq(Frequency.skipN, 'Skip every few days', detail: 'Every day except every ${_n}th day', edit: () => _editN(Frequency.skipN)),
            const SizedBox(height: 8),
            band(),
            title('Dates'),
            dateRow('Starts on', niceDate(_start), _pickStart),
            const Padding(padding: EdgeInsets.only(left: 20), child: Divider()),
            dateRow('Ends on', _end == null ? 'No end date' : niceDate(_end!), _pickEnd, onClear: _end == null ? null : () => setState(() => _end = null)),
            const SizedBox(height: 8),
            band(),
            // the month, as it will come
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 16, 4),
              child: MonthTitle(
                month: _month,
                size: 18,
                canGoBack: _month.isAfter(DateTime(first.year, first.month)),
                onChange: (m) => setState(() => _month = m),
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 10),
              child: Text('Tap a day to take it out', style: TextStyle(fontSize: 13, color: Brand.muted)),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: MonthGrid(
                month: _month,
                cell: (d) {
                  final before = d.isBefore(_start);
                  final due = _plan.due(d) && !before;
                  final removed = _removed.contains(dayOnly(d));
                  final on = due && !removed;
                  return InkWell(
                    customBorder: const CircleBorder(),
                    onTap: !due ? null : () => setState(() => removed ? _removed.remove(dayOnly(d)) : _removed.add(dayOnly(d))),
                    child: Center(
                      child: Container(
                        width: 36,
                        height: 36,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: on ? Brand.accent : null, shape: BoxShape.circle),
                        child: Text(
                          '${d.day}',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: on ? FontWeight.w800 : FontWeight.w500,
                            color: on ? Colors.white : (before ? Brand.faint.withValues(alpha: 0.6) : (removed ? Brand.faint : Brand.ink)),
                            decoration: removed ? TextDecoration.lineThrough : null,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Row(children: [
                Expanded(
                  child: Text('$count deliveries in ${monthNames[_month.month - 1]}',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                ),
                Text('about ${rupees(cost)}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
              ]),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 14, 20, 0),
              child: Text('Skip, change or pause any day later from Calendar, until 9 PM the evening before. Pay in cash on delivery.',
                  style: TextStyle(fontSize: 12.5, color: Brand.muted, height: 1.4)),
            ),
          ],
        ],
      ),
      bottomNavigationBar: StickyBar(
        child: FilledButton(
          onPressed: _busy ? null : _confirm,
          child: _busy
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
              : Text(_subscribe ? 'Start subscription' : 'Add to cart · ${rupees(p.price * _qty)}'),
        ),
      ),
    );
  }
}

/// Two-way switch: a grey track with a white thumb on the chosen side.
class _Segment extends StatelessWidget {
  const _Segment({required this.options, required this.selected, required this.onChanged});
  final List<String> options;
  final int selected;
  final void Function(int) onChanged;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          for (final (i, o) in options.indexed)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  height: 42,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: i == selected ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(11),
                    boxShadow: i == selected ? const [BoxShadow(color: Color(0x14000000), blurRadius: 6, offset: Offset(0, 1))] : null,
                  ),
                  child: Text(o, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: i == selected ? Brand.ink : Brand.muted)),
                ),
              ),
            ),
        ]),
      );
}
