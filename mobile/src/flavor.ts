import * as Application from "expo-application";
import Constants from "expo-constants";
import { defaultAppearance } from "./appearance";

const colors = defaultAppearance.colors;

function flavorIdFromPackage(pkg: string): FlavorId {
  const id = pkg.toLowerCase();
  if (id.endsWith(".admin")) return "admin";
  if (id.endsWith(".staff")) return "staff";
  if (id.endsWith(".support")) return "support";
  return "customer";
}

export type FlavorId = "customer" | "admin" | "staff" | "support";

export type TabId = "home" | "events" | "shop" | "clinics" | "account" | "support" | "certificates";

export type Flavor = {
  id: FlavorId;
  displayName: string;
  accent: string;
  tabs: { id: TabId; title: string; icon: string }[];
};

const ALL: Record<FlavorId, Flavor> = {
  customer: {
    id: "customer",
    displayName: "VGMF",
    accent: colors.secondary,
    tabs: [
      { id: "home", title: "Home", icon: "home" },
      { id: "events", title: "Events", icon: "calendar" },
      { id: "shop", title: "Shop", icon: "book" },
      { id: "clinics", title: "Clinics", icon: "medical" },
      { id: "account", title: "Account", icon: "person" },
    ],
  },
  admin: {
    id: "admin",
    displayName: "VGMF Admin",
    accent: colors.primary,
    tabs: [
      { id: "home", title: "Desk", icon: "grid" },
      { id: "events", title: "Events", icon: "calendar" },
      { id: "shop", title: "Shop", icon: "cube" },
      { id: "support", title: "Tickets", icon: "chatbubbles" },
      { id: "account", title: "Account", icon: "person-circle" },
    ],
  },
  staff: {
    id: "staff",
    displayName: "VGMF Staff",
    accent: "#1F4A32",
    tabs: [
      { id: "home", title: "Home", icon: "home" },
      { id: "events", title: "Events", icon: "calendar" },
      { id: "clinics", title: "Clinics", icon: "medical" },
      { id: "support", title: "Tickets", icon: "chatbubbles" },
      { id: "account", title: "Account", icon: "person" },
    ],
  },
  support: {
    id: "support",
    displayName: "VGMF Support",
    accent: "#8A6A2A",
    tabs: [
      { id: "home", title: "Home", icon: "home" },
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
