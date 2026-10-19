import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models.dart';
import '../store/rider.dart';
import '../theme.dart';

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// "Today", "Yesterday", or "Mon, 14 Oct".
String dayLabel(DateTime d) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(d.year, d.month, d.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  return '${_weekdays[d.weekday - 1]}, ${d.day} ${_months[d.month - 1]}';
}

String _time(DateTime t) {
  final h = t.hour % 12 == 0 ? 12 : t.hour % 12;
  return '$h:${t.minute.toString().padLeft(2, '0')} ${t.hour < 12 ? 'AM' : 'PM'}';
}

/// One day as a row: date, deliveries done, cash collected.
class DeliveryDayTile extends StatelessWidget {
  const DeliveryDayTile({super.key, required this.day, this.onTap});
  final DeliveryDay day;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: Brand.veg.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.task_alt, color: Brand.veg),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(dayLabel(day.day), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text('${day.count} ${day.count == 1 ? 'delivery' : 'deliveries'}', style: const TextStyle(color: Brand.muted, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(rupees(day.cash), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Brand.accent)),
                  const Text('collected', style: TextStyle(fontSize: 12, color: Brand.muted)),
                ],
              ),
              if (onTap != null) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.chevron_right, color: Brand.faint)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Every day the rider delivered in the last 60 days; open a day to see its orders.
class RiderHistoryScreen extends ConsumerStatefulWidget {
  const RiderHistoryScreen({super.key, this.open});

  /// Day to show opened.
  final DateTime? open;

  @override
  ConsumerState<RiderHistoryScreen> createState() => _RiderHistoryScreenState();
}

class _RiderHistoryScreenState extends ConsumerState<RiderHistoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(riderProvider.notifier).loadHistory();
    });
  }

  @override
  Widget build(BuildContext context) {
    final days = ref.watch(riderProvider.select((r) => r.history));
    final total = days.fold<int>(0, (s, d) => s + d.count);
    final cash = days.fold<double>(0, (s, d) => s + d.cash);

    return Scaffold(
      backgroundColor: Brand.surface,
      appBar: AppBar(title: const Text('Previous deliveries', style: TextStyle(fontWeight: FontWeight.w800)), backgroundColor: Brand.surface),
      body: RefreshIndicator(
        color: Brand.accent,
        onRefresh: ref.read(riderProvider.notifier).loadHistory,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            // the last 60 days at a glance
            Container(
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
              child: Row(children: [
                _big('$total', 'Deliveries'),
                Container(width: 1, height: 34, color: Brand.line),
                _big('${days.length}', 'Days worked'),
                Container(width: 1, height: 34, color: Brand.line),
                _big(rupees(cash), 'Cash collected'),
              ]),
            ),
            const SizedBox(height: 6),
            const Padding(padding: EdgeInsets.fromLTRB(4, 8, 4, 12), child: Text('Last 60 days', style: TextStyle(color: Brand.muted, fontWeight: FontWeight.w600))),
            if (days.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 60),
                child: Column(children: [
                  Icon(Icons.history, size: 52, color: Brand.faint),
                  SizedBox(height: 12),
                  Text('No deliveries yet', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                  SizedBox(height: 4),
                  Text('Every delivery you complete shows up here, day by day.', textAlign: TextAlign.center, style: TextStyle(color: Brand.muted)),
                ]),
              ),
            for (final d in days)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  clipBehavior: Clip.antiAlias,
                  child: Theme(
                    data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                    child: ExpansionTile(
                      initiallyExpanded: widget.open != null && DateUtils.isSameDay(widget.open, d.day),
                      tilePadding: const EdgeInsets.fromLTRB(16, 6, 12, 6),
                      childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      leading: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(color: Brand.veg.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.task_alt, color: Brand.veg),
                      ),
                      title: Text(dayLabel(d.day), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                      subtitle: Text('${d.count} ${d.count == 1 ? 'delivery' : 'deliveries'} · ${rupees(d.cash)} collected',
                          style: const TextStyle(color: Brand.muted, fontWeight: FontWeight.w600)),
                      children: [
                        for (final o in d.orders)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                SizedBox(width: 64, child: Text(_time(o.deliveredAt), style: const TextStyle(fontWeight: FontWeight.w700, color: Brand.muted, fontSize: 13))),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(o.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                                      Text(o.address.split(',').take(2).join(','), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Brand.muted, fontSize: 13)),
                                      Text('${o.orderNo} · ${o.items} ${o.items == 1 ? 'item' : 'items'}', style: const TextStyle(color: Brand.faint, fontSize: 12)),
                                    ],
                                  ),
                                ),
                                Text(rupees(o.total), style: const TextStyle(fontWeight: FontWeight.w800)),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _big(String value, String label) => Expanded(
        child: Column(children: [
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Brand.accent)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 12, color: Brand.muted, fontWeight: FontWeight.w600)),
        ]),
      );
}
