import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../store/rider.dart';
import '../theme.dart';
import 'rider_ui.dart';

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

/// Every day the rider delivered in the last 60 days; open a day to see its orders.
class RiderHistoryScreen extends ConsumerStatefulWidget {
  const RiderHistoryScreen({super.key});

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
      appBar: AppBar(title: const Text('Previous deliveries')),
      body: RefreshIndicator(
        color: Brand.accent,
        onRefresh: ref.read(riderProvider.notifier).loadHistory,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            SummaryStrip([
              SummaryItem('$total', 'Deliveries'),
              SummaryItem('${days.length}', 'Days worked'),
              SummaryItem(rupees(cash), 'Cash collected'),
            ]),
            const SectionLabel('Last 60 days'),
            if (days.isEmpty) const RiderEmpty('No deliveries yet', 'Every delivery you complete shows up here, day by day.'),
            for (final d in days)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(riderRadius), side: const BorderSide(color: Brand.line)),
                  clipBehavior: Clip.antiAlias,
                  child: Theme(
                    data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                    child: ExpansionTile(
                      tilePadding: const EdgeInsets.fromLTRB(14, 2, 10, 2),
                      childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                      title: Text(dayLabel(d.day), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                      subtitle: Text('${d.count} ${d.count == 1 ? 'delivery' : 'deliveries'} · ${rupees(d.cash)} collected', style: const TextStyle(color: Brand.muted, fontSize: 13.5)),
                      children: [
                        for (final o in d.orders)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                SizedBox(width: 68, child: Text(_time(o.deliveredAt), style: const TextStyle(color: Brand.muted, fontSize: 13))),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(o.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                                      Text(o.address.split(',').take(2).join(','), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Brand.muted, fontSize: 13)),
                                      Text('${o.orderNo} · ${o.items} ${o.items == 1 ? 'item' : 'items'}', style: const TextStyle(color: Brand.faint, fontSize: 12)),
                                    ],
                                  ),
                                ),
                                Text(rupees(o.total), style: const TextStyle(fontWeight: FontWeight.w600)),
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
}
