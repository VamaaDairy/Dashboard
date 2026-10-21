import 'package:flutter/material.dart';

import 'models.dart';
import 'theme.dart';

/// Calendar colours, as in the legend.
class DayColors {
  static const vacation = Color(0xFFE03131);
  static const delivered = Color(0xFF2F9E44);
  static const upcoming = Color(0xFF4A86E0);
  static const none = Color(0xFF868E96);

  static Color of(DayKind k) => switch (k) {
        DayKind.vacation => vacation,
        DayKind.delivered => delivered,
        DayKind.upcoming => upcoming,
        DayKind.none => none,
      };
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String niceDate(DateTime d) => '${d.day.toString().padLeft(2, '0')} ${monthShort[d.month - 1]} ${d.year}';
bool sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;
DateTime dayOnly(DateTime d) => DateTime(d.year, d.month, d.day);

/// The first day that can still be changed on the phone's clock: tomorrow until 9 PM, then the day after.
DateTime firstEditableLocal([int cutoffHour = 21]) {
  final n = DateTime.now();
  return DateTime(n.year, n.month, n.day + (n.hour < cutoffHour ? 1 : 2));
}

/// Vacation · Delivered · Upcoming · No delivery
class DayLegend extends StatelessWidget {
  const DayLegend({super.key});

  @override
  Widget build(BuildContext context) {
    Widget item(Color c, String t) => Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          Text(t, style: const TextStyle(fontSize: 12, color: Brand.ink)),
        ]);
    return Wrap(spacing: 14, runSpacing: 6, children: [
      item(DayColors.vacation, 'Vacation'),
      item(DayColors.delivered, 'Delivered'),
      item(DayColors.upcoming, 'Upcoming'),
      item(DayColors.none, 'No delivery'),
    ]);
  }
}

/// A month: weekday header (Sun..Sat) and a grid of days; [cell] draws each day of [month].
class MonthGrid extends StatelessWidget {
  const MonthGrid({super.key, required this.month, required this.cell});
  final DateTime month;
  final Widget Function(DateTime day) cell;

  @override
  Widget build(BuildContext context) {
    final first = DateTime(month.year, month.month, 1);
    final lead = first.weekday % 7; // Sunday first
    final days = DateTime(month.year, month.month + 1, 0).day;
    final cells = <Widget>[
      for (var i = 0; i < lead; i++) const SizedBox.shrink(),
      for (var d = 1; d <= days; d++) cell(DateTime(month.year, month.month, d)),
    ];
    while (cells.length % 7 != 0) {
      cells.add(const SizedBox.shrink());
    }
    return Column(children: [
      Row(children: [
        for (final w in const ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
          Expanded(child: Center(child: Text(w, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Brand.muted)))),
      ]),
      const SizedBox(height: 6),
      for (var r = 0; r < cells.length / 7; r++)
        Row(children: [for (var c = 0; c < 7; c++) Expanded(child: AspectRatio(aspectRatio: 1, child: cells[r * 7 + c]))]),
    ]);
  }
}

/// Month title with previous / next arrows.
class MonthHeader extends StatelessWidget {
  const MonthHeader({super.key, required this.month, required this.onChange, this.canGoBack = true});
  final DateTime month;
  final void Function(DateTime) onChange;
  final bool canGoBack;

  @override
  Widget build(BuildContext context) => Row(children: [
        IconButton(
          onPressed: canGoBack ? () => onChange(DateTime(month.year, month.month - 1)) : null,
          icon: const Icon(Icons.chevron_left),
          visualDensity: VisualDensity.compact,
        ),
        Expanded(child: Center(child: Text('${monthNames[month.month - 1]} ${month.year}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)))),
        IconButton(onPressed: () => onChange(DateTime(month.year, month.month + 1)), icon: const Icon(Icons.chevron_right), visualDensity: VisualDensity.compact),
      ]);
}

/// Month title on the left, round outlined arrows on the right.
class MonthTitle extends StatelessWidget {
  const MonthTitle({super.key, required this.month, required this.onChange, this.canGoBack = true, this.size = 22});
  final DateTime month;
  final void Function(DateTime) onChange;
  final bool canGoBack;
  final double size;

  @override
  Widget build(BuildContext context) {
    Widget arrow(IconData icon, VoidCallback? onTap) => InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Brand.line)),
            child: Icon(icon, size: 22, color: onTap == null ? Brand.faint : Brand.ink),
          ),
        );
    return Row(children: [
      Expanded(child: Text('${monthNames[month.month - 1]} ${month.year}', style: TextStyle(fontSize: size, fontWeight: FontWeight.w900, letterSpacing: -0.3))),
      arrow(Icons.chevron_left_rounded, canGoBack ? () => onChange(DateTime(month.year, month.month - 1)) : null),
      const SizedBox(width: 8),
      arrow(Icons.chevron_right_rounded, () => onChange(DateTime(month.year, month.month + 1))),
    ]);
  }
}

/// Pill-shaped choice chip in the subscription style (grey, dark when chosen), with an optional pencil.
class PillChoice extends StatelessWidget {
  const PillChoice({super.key, required this.label, required this.selected, required this.onTap, this.editable = false});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool editable;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          decoration: BoxDecoration(color: selected ? Brand.accent : const Color(0xFFEDEFF3), borderRadius: BorderRadius.circular(22)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(label, style: TextStyle(color: selected ? Colors.white : Brand.muted, fontWeight: FontWeight.w600, fontSize: 14)),
            if (editable) ...[
              const SizedBox(width: 6),
              Icon(Icons.edit_outlined, size: 15, color: selected ? Colors.white : DayColors.vacation),
            ],
          ]),
        ),
      );
}

/// - n + stepper.
class QtyStepper extends StatelessWidget {
  const QtyStepper({super.key, required this.value, required this.onChanged, this.min = 1, this.max = 20});
  final int value;
  final int min;
  final int max;
  final void Function(int) onChanged;

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(12)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          IconButton(visualDensity: VisualDensity.compact, onPressed: value > min ? () => onChanged(value - 1) : null, icon: const Icon(Icons.remove, size: 18, color: Brand.ink)),
          SizedBox(width: 26, child: Text('$value', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
          IconButton(visualDensity: VisualDensity.compact, onPressed: value < max ? () => onChanged(value + 1) : null, icon: const Icon(Icons.add, size: 18, color: Brand.ink)),
        ]),
      );
}
