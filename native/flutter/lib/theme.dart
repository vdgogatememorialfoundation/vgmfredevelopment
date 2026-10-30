import "package:flutter/material.dart";

class VgmfColors {
  static const ink = Color(0xFF0B1F3A);
  static const inkSoft = Color(0xFF16325C);
  static const gold = Color(0xFFC4954A);
  static const burgundy = Color(0xFF8F2D2D);
  static const paper = Color(0xFFF7F3EA);
  static const cream = Color(0xFFFFFDF8);
  static const muted = Color(0xFF5C5648);
  static const border = Color(0xFFE4D8C4);
}

ThemeData vgmfTheme({Color seed = VgmfColors.ink}) {
  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: seed, primary: seed, surface: VgmfColors.cream),
    scaffoldBackgroundColor: VgmfColors.cream,
    appBarTheme: const AppBarTheme(
      backgroundColor: VgmfColors.ink,
      foregroundColor: VgmfColors.paper,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: VgmfColors.border),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: VgmfColors.gold.withValues(alpha: 0.25),
      labelTextStyle: const WidgetStatePropertyAll(TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: VgmfColors.burgundy,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(46),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
  );
}
