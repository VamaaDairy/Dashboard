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

    Widget label(String t) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 10),
          child: Text(t, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
        );
    Widget rule() => const Padding(padding: EdgeInsets.symmetric(horizontal: 20), child: Divider(height: 24));
    // a frequency chip; the ones with days or a number open their picker when chosen
    Widget freq(Frequency f, String name, {Future<void> Function()? edit}) => PillChoice(
          label: name,
          selected: _freq == f,
          editable: edit != null,
          onTap: () async {
            setState(() => _freq = f);
            if (edit != null) await edit();
          },
        );
    final detail = switch (_freq) {
      Frequency.daily => 'Every day',
      Frequency.alternate => 'Every other day',
      Frequency.weekdays => SubPlan(frequency: Frequency.weekdays, start: _start, weekdays: _weekdays, everyN: _n).describe,
      Frequency.everyN => 'Every $_n days',
      Frequency.skipN => 'Every day except every ${_n}th day',
    };

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        titleSpacing: 0,
        title: const Text('Subscription', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider()),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          // the product, big, with its saving in the corner
          SizedBox(
            height: 260,
            child: Stack(children: [
              Positioned.fill(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(40, 20, 40, 12),
                  child: Hero(tag: 'p-${p.sku}', child: ProductImage(url: p.image, radius: 0, fit: BoxFit.contain)),
                ),
              ),
              if (p.offPercent > 0)
                Positioned(
                  top: 16,
                  right: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: Brand.gaiaGreen, borderRadius: BorderRadius.circular(20)),
                    child: Text('${p.offPercent}% OFF', style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w800)),
                  ),
                ),
            ]),
          ),
          // name and quantity on the left, the price on the right
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, height: 1.25)),
                  if (p.size != null && p.size!.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(p.size!, style: const TextStyle(color: Brand.muted, fontSize: 14, fontWeight: FontWeight.w600)),
                  ],
                ]),
              ),
              const SizedBox(width: 12),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                  Text(rupees(p.price), style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
                  if (p.offPercent > 0) ...[
                    const SizedBox(width: 6),
                    Text(rupees(p.mrp), style: const TextStyle(fontSize: 13.5, color: Brand.faint, decoration: TextDecoration.lineThrough)),
                  ],
                ]),
                const Text('inclusive of all taxes', style: TextStyle(fontSize: 12, color: Brand.muted)),
              ]),
            ]),
          ),
          rule(),

          // once or regularly
          label('Subscription type'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Wrap(spacing: 10, children: [
              PillChoice(label: 'One time', selected: !_subscribe, onTap: () => setState(() => _subscribe = false)),
              PillChoice(label: 'Subscription', selected: _subscribe, onTap: () => setState(() => _subscribe = true)),
            ]),
          ),

          if (_subscribe) ...[
            label('Frequency'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Wrap(spacing: 10, runSpacing: 10, children: [
                freq(Frequency.daily, 'Daily'),
                freq(Frequency.alternate, 'Alternate'),
                freq(Frequency.weekdays, 'Custom', edit: _editWeekdays),
                freq(Frequency.everyN, 'Every nth day', edit: () => _editN(Frequency.everyN)),
                freq(Frequency.skipN, "Don't deliver on nth day", edit: () => _editN(Frequency.skipN)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
              child: Text(detail, style: const TextStyle(fontSize: 13, color: Brand.muted)),
            ),
          ],

          // how many
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Quantity', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                  Text(_subscribe ? 'On every delivery' : 'Added to your cart', style: const TextStyle(fontSize: 12.5, color: Brand.muted)),
                ]),
              ),
              QtyStepper(value: _qty, onChanged: (v) => setState(() => _qty = v)),
            ]),
          ),

          if (_subscribe) ...[
            // an end date is optional
            InkWell(
              onTap: _pickEnd,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 12, 4),
                child: Row(children: [
                  const Expanded(child: Text('End date', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800))),
                  Text(_end == null ? 'No end date' : niceDate(_end!), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: _end == null ? Brand.muted : Brand.ink)),
                  const SizedBox(width: 4),
                  if (_end != null)
                    InkWell(onTap: () => setState(() => _end = null), customBorder: const CircleBorder(), child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.close_rounded, size: 18, color: Brand.muted)))
                  else
                    const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.edit_outlined, size: 18, color: DayColors.vacation)),
                ]),
              ),
            ),
            rule(),

            // the month, as it will come
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 12, 0),
              child: Row(children: [
                const Expanded(child: Text('Calendar preview', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800))),
                SizedBox(width: 190, child: MonthHeader(month: _month, canGoBack: _month.isAfter(DateTime(first.year, first.month)), onChange: (m) => setState(() => _month = m))),
              ]),
            ),
            Container(
              margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              padding: const EdgeInsets.fromLTRB(4, 10, 4, 10),
              decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(16)),
              child: MonthGrid(
                month: _month,
                cell: (d) {
                  final before = d.isBefore(_start);
                  final due = _plan.due(d) && !before;
                  final removed = _removed.contains(dayOnly(d));
                  final on = due && !removed;
                  return InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: !due ? null : () => setState(() => removed ? _removed.remove(dayOnly(d)) : _removed.add(dayOnly(d))),
                    child: Center(
                      child: Container(
                        width: 36,
                        height: 36,
                        alignment: Alignment.center,
                        // a delivery day is boxed in green, a day taken out is struck through
                        decoration: BoxDecoration(
                          color: on ? Colors.white : null,
                          border: on ? Border.all(color: Brand.veg, width: 1.6) : null,
                          borderRadius: BorderRadius.circular(9),
                        ),
                        child: Text(
                          '${d.day}',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: on ? FontWeight.w800 : FontWeight.w500,
                            color: on ? Brand.ink : (before ? Brand.faint.withValues(alpha: 0.6) : (removed ? DayColors.vacation : Brand.faint)),
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
                  child: Text('$count deliveries in ${monthNames[_month.month - 1]} · tap a day to take it out',
                      style: const TextStyle(fontSize: 13, color: Brand.muted)),
                ),
                Text('≈ ${rupees(cost)}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
              ]),
            ),
          ],
          rule(),

          // the small print, and what the product is
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Skip, change or pause any day from Calendar until 9 PM the evening before. Pay in cash on delivery. '
              'Items may vary slightly in size and weight.',
              style: TextStyle(fontSize: 13, color: Brand.muted, height: 1.45),
            ),
          ),
          if (p.description != null && p.description!.trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Text(p.description!.trim(), style: const TextStyle(fontSize: 13.5, color: Brand.muted, height: 1.45)),
            ),
        ],
      ),
      // start date and confirm, always in reach
      bottomNavigationBar: StickyBar(
        child: Row(children: [
          if (_subscribe) ...[
            InkWell(
              onTap: _pickStart,
              borderRadius: BorderRadius.circular(14),
              child: Container(
                padding: const EdgeInsets.fromLTRB(14, 6, 10, 6),
                decoration: BoxDecoration(color: Brand.surface, borderRadius: BorderRadius.circular(14)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  const Text('Start date', style: TextStyle(fontSize: 11, color: Brand.muted, fontWeight: FontWeight.w600)),
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(niceDate(_start), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                    const SizedBox(width: 6),
                    const Icon(Icons.edit_outlined, size: 16, color: DayColors.vacation),
                  ]),
                ]),
              ),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: FilledButton(
              onPressed: _busy ? null : _confirm,
              child: _busy
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                  : FittedBox(child: Text(_subscribe ? 'CONFIRM SUBSCRIPTION' : 'ADD TO CART · ${rupees(p.price * _qty)}')),
            ),
          ),
        ]),
      ),
    );
  }
}
