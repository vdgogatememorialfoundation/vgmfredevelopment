import Constants from "expo-constants";
import { colors } from "./theme";

export type FlavorId = "customer" | "admin" | "staff" | "support";

export type TabId = "home" | "events" | "shop" | "clinics" | "account" | "support" | "notices" | "certificates";

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
    accent: colors.ink,
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
    accent: colors.burgundyDark,
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
      { id: "notices", title: "Notices", icon: "megaphone" },
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
  const raw = String(
    process.env.EXPO_PUBLIC_FLAVOR || Constants.expoConfig?.extra?.flavor || "customer"
  )
    .trim()
    .toLowerCase();
  return ALL[(raw as FlavorId)] ?? ALL.customer;
}
