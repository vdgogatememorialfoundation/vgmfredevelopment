import * as Application from "expo-application";
import Constants from "expo-constants";
import { defaultAppearance } from "./appearance";

const colors = defaultAppearance.colors;

function flavorIdFromPackage(pkg: string): FlavorId {
  const id = pkg.toLowerCase();
  if (id.includes(".admin")) return "admin";
  if (id.includes(".scanner")) return "scanner";
  if (id.includes(".pos")) return "pos";
  if (id.includes(".staff")) return "staff";
  if (id.includes(".support")) return "support";
  if (id.includes(".delivery")) return "delivery";
  return "customer";
}

export type FlavorId = "customer" | "admin" | "scanner" | "pos" | "staff" | "support" | "delivery";

export type TabId = "home" | "articles" | "events" | "shop" | "clinics" | "account" | "support" | "certificates";

export type Flavor = {
  id: FlavorId;
  displayName: string;
  subtitle: string;
  accent: string;
  tabs: { id: TabId; title: string; icon: string }[];
};

const ALL: Record<FlavorId, Flavor> = {
  customer: {
    id: "customer",
    displayName: "Vaidya Gogate Memorial Foundation",
    subtitle: "Ayurveda Publications, Seminars & Clinics",
    accent: colors.secondary,
    tabs: [
      { id: "home", title: "Home", icon: "home" },
      { id: "shop", title: "Shop", icon: "bag-handle" },
      { id: "events", title: "Events", icon: "calendar" },
      { id: "clinics", title: "Clinics", icon: "medkit" },
      { id: "account", title: "Account", icon: "person" },
    ],
  },
  admin: {
    id: "admin",
    displayName: "VGMF Admin",
    subtitle: "Operations, Orders & Balance Reminders",
    accent: "#8F2D2D",
    tabs: [
      { id: "home", title: "Dashboard", icon: "grid" },
      { id: "shop", title: "Orders", icon: "cube" },
      { id: "events", title: "Packed", icon: "archive" },
      { id: "support", title: "Tickets", icon: "chatbubbles" },
      { id: "account", title: "Account", icon: "person-circle" },
    ],
  },
  scanner: {
    id: "scanner",
    displayName: "VGMF Picker & Packer",
    subtitle: "Warehouse Barcode & QR Scanner",
    accent: "#067D62",
    tabs: [
      { id: "home", title: "Pick", icon: "barcode" },
      { id: "shop", title: "Pack", icon: "cube" },
      { id: "events", title: "Scan", icon: "qr-code" },
      { id: "account", title: "Account", icon: "person-circle" },
    ],
  },
  pos: {
    id: "pos",
    displayName: "VGMF Store POS",
    subtitle: "In-Store Counter Billing & Receipts",
    accent: "#8F2D2D",
    tabs: [
      { id: "home", title: "Counter", icon: "storefront" },
      { id: "shop", title: "Bill", icon: "receipt" },
      { id: "events", title: "Sales", icon: "stats-chart" },
      { id: "account", title: "Account", icon: "person-circle" },
    ],
  },
  staff: {
    id: "staff",
    displayName: "VGMF Staff",
    subtitle: "Daily Desk, Orders & Support",
    accent: "#1F4A32",
    tabs: [
      { id: "home", title: "Desk", icon: "briefcase" },
      { id: "shop", title: "Orders", icon: "cube" },
      { id: "events", title: "Pick/Pack", icon: "barcode" },
      { id: "support", title: "Tickets", icon: "chatbubbles" },
      { id: "account", title: "Account", icon: "person-circle" },
    ],
  },
  delivery: {
    id: "delivery",
    displayName: "VGMF Delivery",
    subtitle: "Delivery Executive & Hyperlocal Rider",
    accent: "#8F2D2D",
    tabs: [
      { id: "home", title: "Duty", icon: "bicycle" },
      { id: "account", title: "Account", icon: "person-circle" },
    ],
  },
  support: {
    id: "support",
    displayName: "VGMF Support",
    subtitle: "Customer Helpdesk & Tickets",
    accent: "#8A6A2A",
    tabs: [
      { id: "home", title: "Desk", icon: "headset" },
      { id: "support", title: "Tickets", icon: "chatbubbles" },
      { id: "certificates", title: "Certificates", icon: "ribbon" },
      { id: "account", title: "Account", icon: "person" },
    ],
  },
};

export function currentFlavor(): Flavor {
  const env = String(process.env.EXPO_PUBLIC_FLAVOR || "").trim().toLowerCase();
  if (env && ALL[env as FlavorId]) return ALL[env as FlavorId];
  const pkg = String(Application.applicationId || Constants.expoConfig?.android?.package || "");
  return ALL[flavorIdFromPackage(pkg)];
}
