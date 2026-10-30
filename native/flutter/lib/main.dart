import "package:flutter/material.dart";

import "flavor.dart";
import "portal_page.dart";

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(VgmfApp(flavor: Flavor.current()));
}

class VgmfApp extends StatelessWidget {
  const VgmfApp({super.key, required this.flavor});

  final Flavor flavor;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: flavor.displayName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0B1F3A),
          primary: const Color(0xFF0B1F3A),
        ),
        useMaterial3: true,
      ),
      home: PortalPage(flavor: flavor),
    );
  }
}
