import "package:flutter/material.dart";
import "package:flutter/services.dart";

import "theme.dart";

class Flavor {
  const Flavor({
    required this.id,
    required this.displayName,
    required this.accent,
    required this.tabs,
  });

  final String id;
  final String displayName;
  final Color accent;
  final List<({String id, String label, IconData icon})> tabs;

  static const _all = <String, Flavor>{
    "customer": Flavor(
      id: "customer",
      displayName: "VGMF",
      accent: VgmfColors.ink,
      tabs: [
        (id: "home", label: "Home", icon: Icons.home_rounded),
        (id: "events", label: "Events", icon: Icons.event_rounded),
        (id: "shop", label: "Shop", icon: Icons.menu_book_rounded),
        (id: "clinics", label: "Clinics", icon: Icons.local_hospital_rounded),
        (id: "account", label: "Account", icon: Icons.person_rounded),
      ],
    ),
    "admin": Flavor(
      id: "admin",
      displayName: "VGMF Admin",
      accent: Color(0xFF6A1F1F),
      tabs: [
        (id: "home", label: "Desk", icon: Icons.dashboard_rounded),
        (id: "events", label: "Events", icon: Icons.event_rounded),
        (id: "shop", label: "Shop", icon: Icons.inventory_2_rounded),
        (id: "support", label: "Tickets", icon: Icons.support_agent_rounded),
        (id: "account", label: "Account", icon: Icons.manage_accounts_rounded),
      ],
    ),
    "staff": Flavor(
      id: "staff",
      displayName: "VGMF Staff",
      accent: Color(0xFF1F4A32),
      tabs: [
        (id: "home", label: "Home", icon: Icons.home_work_rounded),
        (id: "events", label: "Events", icon: Icons.event_rounded),
        (id: "notices", label: "Notices", icon: Icons.campaign_rounded),
        (id: "support", label: "Tickets", icon: Icons.support_agent_rounded),
        (id: "account", label: "Account", icon: Icons.badge_rounded),
      ],
    ),
    "support": Flavor(
      id: "support",
      displayName: "VGMF Support",
      accent: Color(0xFF8A6A2A),
      tabs: [
        (id: "home", label: "Home", icon: Icons.home_rounded),
        (id: "support", label: "Tickets", icon: Icons.support_agent_rounded),
        (id: "certificates", label: "Certificates", icon: Icons.verified_rounded),
        (id: "account", label: "Account", icon: Icons.person_rounded),
      ],
    ),
  };

  static Flavor current() {
    final name = (appFlavor ?? const String.fromEnvironment("FLAVOR", defaultValue: "customer")).trim().toLowerCase();
    return _all[name] ?? _all["customer"]!;
  }
}

const siteUrl = String.fromEnvironment("SITE_URL", defaultValue: "https://vaidyagogate.org");
