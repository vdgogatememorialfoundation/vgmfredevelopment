import "package:flutter/services.dart";

class Flavor {
  const Flavor({
    required this.id,
    required this.displayName,
    required this.startPath,
  });

  final String id;
  final String displayName;
  final String startPath;

  static const _all = <String, Flavor>{
    "customer": Flavor(id: "customer", displayName: "VGMF", startPath: "/"),
    "admin": Flavor(id: "admin", displayName: "VGMF Admin", startPath: "/admin"),
    "staff": Flavor(id: "staff", displayName: "VGMF Staff", startPath: "/staff"),
    "support": Flavor(id: "support", displayName: "VGMF Support", startPath: "/account/tickets"),
  };

  static Flavor current() {
    final name = (appFlavor ?? const String.fromEnvironment("FLAVOR", defaultValue: "customer"))
        .trim()
        .toLowerCase();
    return _all[name] ?? _all["customer"]!;
  }
}

const siteUrl = String.fromEnvironment(
  "SITE_URL",
  defaultValue: "https://vaidyagogate.org",
);
