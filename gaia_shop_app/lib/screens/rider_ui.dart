import 'package:flutter/material.dart';

import '../theme.dart';

/// The delivery partner screens share one flat look: white panels with a hairline border on a pale page,
/// one blue accent, plain text for status. Nothing here is tinted, pill-shaped or heavier than w700.
const double riderRadius = 8;

final _shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(riderRadius));

ButtonStyle riderFilled({Color? color}) => FilledButton.styleFrom(
      backgroundColor: color ?? Brand.accent,
      minimumSize: const Size.fromHeight(48),
      shape: _shape,
      textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
    );

ButtonStyle riderOutlined() => OutlinedButton.styleFrom(
      foregroundColor: Brand.ink,
      minimumSize: const Size(0, 48),
      side: const BorderSide(color: Brand.line, width: 1.2),
      shape: _shape,
      textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
    );

/// White box with a hairline border; tappable when [onTap] is given.
class RiderPanel extends StatelessWidget {
  const RiderPanel({super.key, required this.child, this.onTap, this.padding = const EdgeInsets.all(14)});
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(riderRadius);
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: radius, side: const BorderSide(color: Brand.line)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
    );
  }
}

/// Small grey heading above a block, e.g. "OUT FOR DELIVERY · 2".
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 20, 2, 8),
        child: Row(children: [
          Expanded(child: Text(text.toUpperCase(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: Brand.muted))),
          if (trailing != null) trailing!,
        ]),
      );
}

class SummaryItem {
  const SummaryItem(this.value, this.label);
  final String value;
  final String label;
}

/// Two or three figures in one bordered strip, separated by hairlines.
class SummaryStrip extends StatelessWidget {
  const SummaryStrip(this.items, {super.key});
  final List<SummaryItem> items;

  @override
  Widget build(BuildContext context) => RiderPanel(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: IntrinsicHeight(
          child: Row(children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) const VerticalDivider(width: 1, color: Brand.line),
              Expanded(
                child: Column(children: [
                  Text(items[i].value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(items[i].label, style: const TextStyle(fontSize: 12, color: Brand.muted)),
                ]),
              ),
            ],
          ]),
        ),
      );
}

/// Centered message for an empty list.
class RiderEmpty extends StatelessWidget {
  const RiderEmpty(this.title, this.hint, {super.key});
  final String title;
  final String hint;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 56, 24, 0),
        child: Column(children: [
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(hint, textAlign: TextAlign.center, style: const TextStyle(color: Brand.muted, height: 1.35)),
        ]),
      );
}

/// A message line above the list: location off, load failed.
class RiderNotice extends StatelessWidget {
  const RiderNotice(this.text, {super.key, this.color = Brand.warn, this.onRetry});
  final String text;
  final Color color;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Row(children: [
          Expanded(child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w600, height: 1.3))),
          if (onRetry != null) TextButton(onPressed: onRetry, child: const Text('Retry')),
        ]),
      );
}
