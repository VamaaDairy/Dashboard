import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'theme.dart';

/// A row of one-digit boxes for an SMS code ([length] 6) or a PIN (5). One hidden field underneath does
/// the typing, so paste, backspace and the keyboard's "code from SMS" suggestion all work.
/// [onCompleted] fires as soon as the last digit goes in.
class CodeBoxes extends StatefulWidget {
  const CodeBoxes({
    super.key,
    required this.controller,
    this.length = 6,
    this.obscure = false,
    this.hasError = false,
    this.autofocus = false,
    this.otp = false,
    this.onCompleted,
    this.onChanged,
    this.focusNode,
  });

  final TextEditingController controller;
  final int length;

  /// Show dots instead of digits (a PIN).
  final bool obscure;
  final bool hasError;
  final bool autofocus;

  /// Lets the phone offer the code from the SMS it just received.
  final bool otp;
  final ValueChanged<String>? onCompleted;
  final ValueChanged<String>? onChanged;
  final FocusNode? focusNode;

  @override
  State<CodeBoxes> createState() => _CodeBoxesState();
}

class _CodeBoxesState extends State<CodeBoxes> {
  late final FocusNode _ownFocus = FocusNode();
  FocusNode get _focus => widget.focusNode ?? _ownFocus;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_changed);
    _focus.addListener(_changed);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    _focus.removeListener(_changed);
    _ownFocus.dispose();
    super.dispose();
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  void _typed(String v) {
    widget.onChanged?.call(v);
    if (v.length == widget.length) widget.onCompleted?.call(v);
  }

  @override
  Widget build(BuildContext context) {
    final text = widget.controller.text;
    final focused = _focus.hasFocus;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _focus.requestFocus(),
      child: Stack(alignment: Alignment.center, children: [
        // the real field: invisible, but it holds focus, the keyboard and the autofill
        Positioned.fill(
          child: Opacity(
            opacity: 0,
            child: TextField(
              controller: widget.controller,
              focusNode: _focus,
              autofocus: widget.autofocus,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              autofillHints: widget.otp ? const [AutofillHints.oneTimeCode] : null,
              enableInteractiveSelection: false,
              showCursor: false,
              maxLength: widget.length,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              onChanged: _typed,
              decoration: const InputDecoration(counterText: '', border: InputBorder.none),
            ),
          ),
        ),
        IgnorePointer(
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < widget.length; i++) ...[
              if (i > 0) SizedBox(width: widget.length > 5 ? 8 : 10),
              _box(i, text, focused),
            ],
          ]),
        ),
      ]),
    );
  }

  Widget _box(int i, String text, bool focused) {
    final filled = i < text.length;
    final active = focused && i == (text.length < widget.length ? text.length : widget.length - 1);
    final border = widget.hasError ? Brand.danger : active ? Brand.accent : filled ? Brand.accent.withValues(alpha: 0.35) : Brand.line;
    return Flexible(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 52),
        child: AspectRatio(
          aspectRatio: 0.86,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: active ? Brand.accentTint : Brand.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: border, width: active || widget.hasError ? 2 : 1.4),
            ),
            child: !filled
                ? (active ? Container(width: 2, height: 22, color: Brand.accent) : null)
                : widget.obscure
                    ? Container(width: 12, height: 12, decoration: const BoxDecoration(color: Brand.ink, shape: BoxShape.circle))
                    : Text(text[i], style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
          ),
        ),
      ),
    );
  }
}
