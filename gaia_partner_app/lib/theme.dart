import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// One place for the look. To re-colour the whole app, change [accent].
class Brand {
  static const Color accent = Color(0xFF2B3990); // Gaia blue: primary actions, links, selection
  static const Color accentDark = Color(0xFF1E2A70);
  static const Color accentTint = Color(0xFFEEF1FB);
  static const Color sky = Color(0xFF4A86E0); // the lighter blue of the banners and "upcoming"
  static const Color gaiaGreen = Color(0xFF34A853);
  static const Color veg = Color(0xFF1E8E3E); // success / delivered / savings
  static const Color danger = Color(0xFFD93025); // errors and cancelled orders
  static const Color warn = Color(0xFFB45309);
  static const Color ink = Color(0xFF111827);
  static const Color muted = Color(0xFF6B7280);
  static const Color faint = Color(0xFF9CA3AF);
  static const Color line = Color(0xFFE9ECF2);
  static const Color surface = Color(0xFFF5F7FB); // soft panels on the white page
  static const Color page = Colors.white;

  /// Corner radius used everywhere: cards, buttons, inputs, sheets.
  static const double radius = 16;

  /// The soft shadow under floating things (cart bar, sticky buttons, cards on images).
  static const List<BoxShadow> lift = [BoxShadow(color: Color(0x14111827), blurRadius: 18, offset: Offset(0, 6))];
}

/// The app's one typeface (bundled in assets/fonts).
const appFont = 'PlusJakartaSans';
TextTheme _text(TextTheme base) => base.apply(fontFamily: appFont, bodyColor: Brand.ink, displayColor: Brand.ink);

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: Brand.accent, primary: Brand.accent, secondary: Brand.gaiaGreen, surface: Colors.white, error: Brand.danger, brightness: Brightness.light);
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, fontFamily: appFont);
  final text = _text(base.textTheme);
  final r = BorderRadius.circular(Brand.radius);
  final label = text.labelLarge!.copyWith(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: 0.1);

  return base.copyWith(
    scaffoldBackgroundColor: Brand.page,
    textTheme: text,
    primaryTextTheme: _text(base.primaryTextTheme),
    splashFactory: InkSparkle.splashFactory,
    // slide-and-fade between pages, the same on every phone
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
    }),
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: Brand.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0.6,
      shadowColor: const Color(0x22000000),
      centerTitle: false,
      titleSpacing: 4,
      systemOverlayStyle: SystemUiOverlayStyle.dark.copyWith(statusBarColor: Colors.transparent),
      titleTextStyle: text.titleLarge!.copyWith(fontSize: 19, fontWeight: FontWeight.w800, color: Brand.ink),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Brand.accent,
        foregroundColor: Colors.white,
        disabledBackgroundColor: const Color(0xFFD7DBE6),
        disabledForegroundColor: Colors.white,
        minimumSize: const Size.fromHeight(54),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: r),
        textStyle: label,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Brand.accent,
        minimumSize: const Size(0, 48),
        side: const BorderSide(color: Brand.line, width: 1.4),
        shape: RoundedRectangleBorder(borderRadius: r),
        textStyle: label.copyWith(fontSize: 15),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: Brand.accent, textStyle: label.copyWith(fontSize: 14.5)),
    ),
    iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(foregroundColor: Brand.ink)),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Brand.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      labelStyle: text.bodyLarge!.copyWith(color: Brand.muted),
      floatingLabelStyle: text.bodyLarge!.copyWith(color: Brand.accent, fontWeight: FontWeight.w600),
      hintStyle: text.bodyLarge!.copyWith(color: Brand.faint),
      prefixIconColor: Brand.muted,
      border: OutlineInputBorder(borderRadius: r, borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(borderRadius: r, borderSide: const BorderSide(color: Colors.transparent)),
      focusedBorder: OutlineInputBorder(borderRadius: r, borderSide: const BorderSide(color: Brand.accent, width: 1.6)),
      errorBorder: OutlineInputBorder(borderRadius: r, borderSide: const BorderSide(color: Brand.danger, width: 1.2)),
      focusedErrorBorder: OutlineInputBorder(borderRadius: r, borderSide: const BorderSide(color: Brand.danger, width: 1.6)),
    ),
    cardTheme: CardThemeData(color: Colors.white, elevation: 0, margin: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: r, side: const BorderSide(color: Brand.line))),
    dividerTheme: const DividerThemeData(color: Brand.line, thickness: 1, space: 1),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: Color(0xFFD5D9E2),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      titleTextStyle: text.titleLarge!.copyWith(fontWeight: FontWeight.w800),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: Brand.ink,
      contentTextStyle: text.bodyMedium!.copyWith(color: Colors.white, fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      insetPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      height: 68,
      indicatorColor: Brand.accentTint,
      indicatorShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      labelTextStyle: WidgetStateProperty.resolveWith((s) => text.labelMedium!.copyWith(
            fontSize: 12,
            fontWeight: s.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w600,
            color: s.contains(WidgetState.selected) ? Brand.accent : Brand.muted,
          )),
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(size: 24, color: s.contains(WidgetState.selected) ? Brand.accent : Brand.muted)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Brand.surface,
      selectedColor: Brand.accent,
      side: BorderSide.none,
      shape: const StadiumBorder(),
      labelStyle: text.labelLarge!.copyWith(fontWeight: FontWeight.w600),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: Brand.accent),
    expansionTileTheme: const ExpansionTileThemeData(shape: Border(), collapsedShape: Border()),
    listTileTheme: ListTileThemeData(iconColor: Brand.accent, titleTextStyle: text.titleMedium!.copyWith(fontWeight: FontWeight.w700, fontSize: 15.5)),
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
