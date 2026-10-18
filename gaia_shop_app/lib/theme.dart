import 'package:flutter/material.dart';

/// One place for the look. To re-colour the whole app, change [accent].
class Brand {
  static const Color accent = Color(0xFF2B3990); // Gaia blue: ADD button, cart bar, links
  static const Color accentTint = Color(0xFFEEF0FA);
  static const Color danger = Color(0xFFD93025); // errors and cancelled orders
  static const Color ink = Color(0xFF1C1C1C);
  static const Color muted = Color(0xFF6B6B6B);
  static const Color faint = Color(0xFF9B9B9B);
  static const Color line = Color(0xFFE8E8E8);
  static const Color veg = Color(0xFF0F8A3C);
  static const Color surface = Color(0xFFF6F7FB);
  static const Color gaiaGreen = Color(0xFF3AB54A);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: Brand.accent,
    primary: Brand.accent,
    brightness: Brightness.light,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: Colors.white,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: Brand.ink,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFCFCFCF)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFCFCFCF)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Brand.accent, width: 1.6),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Brand.accent,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
  );
}

String rupees(num n) {
  final whole = n == n.roundToDouble();
  final s = whole ? n.toStringAsFixed(0) : n.toStringAsFixed(2);
  // Indian digit grouping: 12,34,567
  final parts = s.split('.');
  var digits = parts[0];
  if (digits.length > 3) {
    final last3 = digits.substring(digits.length - 3);
    var rest = digits.substring(0, digits.length - 3);
    final buf = <String>[];
    while (rest.length > 2) {
      buf.insert(0, rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) buf.insert(0, rest);
    digits = '${buf.join(',')},$last3';
  }
  return '₹$digits${parts.length > 1 ? '.${parts[1]}' : ''}';
}
