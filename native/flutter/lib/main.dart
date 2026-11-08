import "package:flutter/material.dart";

import "app.dart";
import "customer.dart";
import "flavor.dart";
import "theme.dart";

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(VgmfRoot(flavor: Flavor.current()));
}

class VgmfRoot extends StatelessWidget {
  const VgmfRoot({super.key, required this.flavor});
  final Flavor flavor;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: flavor.displayName,
      debugShowCheckedModeBanner: false,
      theme: vgmfTheme(seed: flavor.accent),
      home: flavor.id == "customer" ? const CustomerApp() : VgmfShell(flavor: flavor),
    );
  }
}
