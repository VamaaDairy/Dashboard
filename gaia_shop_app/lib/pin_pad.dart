import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'theme.dart';

/// The dots that show how many PIN digits are in. [error] turns them red.
class PinDots extends StatelessWidget {
  const PinDots({super.key, required this.filled, this.length = 5, this.error = false});

  final int filled;
  final int length;
  final bool error;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisAlignment: MainAxisAlignment.center, children: [
      for (var i = 0; i < length; i++)
        AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          margin: const EdgeInsets.symmetric(horizontal: 9),
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: i < filled ? (error ? Brand.danger : Brand.accent) : Colors.transparent,
            border: Border.all(color: error ? Brand.danger : i < filled ? Brand.accent : Brand.line, width: 2),
          ),
        ),
    ]);
  }
}

/// Our own on-screen number pad for choosing a PIN: always on screen (no system keyboard to pop up and
/// cover the page), big thumb-sized keys, a tick of haptic feedback on each press.
class PinPad extends StatelessWidget {
  const PinPad({super.key, required this.value, required this.onChanged, this.length = 5, this.enabled = true});

  final String value;
  final ValueChanged<String> onChanged;
  final int length;
  final bool enabled;

  void _digit(String d) {
    if (!enabled || value.length >= length) return;
    HapticFeedback.selectionClick();
    onChanged(value + d);
  }

  void _back() {
    if (!enabled || value.isEmpty) return;
    HapticFeedback.selectionClick();
    onChanged(value.substring(0, value.length - 1));
  }

  Widget _key(Widget child, VoidCallback? onTap, {VoidCallback? onLongPress}) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.all(5),
        child: Material(
          color: onTap == null ? Colors.transparent : Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: onTap == null ? BorderSide.none : const BorderSide(color: Brand.line),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: onTap,
            onLongPress: onLongPress,
            child: SizedBox(height: 62, child: Center(child: child)),
          ),
        ),
      ),
    );
  }

  Widget _num(String d) => _key(Text(d, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700)), () => _digit(d));

  @override
  Widget build(BuildContext context) {
    return Column(mainAxisSize: MainAxisSize.min, children: [
      for (final row in const [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
      ])
        Row(children: [for (final d in row) _num(d)]),
      Row(children: [
        _key(const SizedBox.shrink(), null),
        _num('0'),
        _key(const Icon(Icons.backspace_outlined, size: 26), value.isEmpty ? null : _back, onLongPress: () => onChanged('')),
      ]),
    ]);
  }
}
