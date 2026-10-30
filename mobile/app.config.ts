import appJson from "./app.json";

type FlavorId = "customer" | "admin" | "staff" | "support";

const FLAVORS: Record<FlavorId, { name: string; androidPackage: string; iosBundle: string }> = {
  customer: { name: "VGMF", androidPackage: "org.vaidyagogate.customer", iosBundle: "org.vaidyagogate.customer" },
  admin: { name: "VGMF Admin", androidPackage: "org.vaidyagogate.admin", iosBundle: "org.vaidyagogate.admin" },
  staff: { name: "VGMF Staff", androidPackage: "org.vaidyagogate.staff", iosBundle: "org.vaidyagogate.staff" },
  support: { name: "VGMF Support", androidPackage: "org.vaidyagogate.support", iosBundle: "org.vaidyagogate.support" },
};

const rawFlavor = String(process.env.EXPO_PUBLIC_FLAVOR || appJson.expo.extra.flavor || "customer")
  .trim()
  .toLowerCase();
const flavorId: FlavorId = rawFlavor in FLAVORS ? (rawFlavor as FlavorId) : "customer";
const flavor = FLAVORS[flavorId];

const config = {
  expo: {
    ...appJson.expo,
    name: flavor.name,
    ios: {
      ...appJson.expo.ios,
      bundleIdentifier: flavor.iosBundle,
      infoPlist: { ...appJson.expo.ios.infoPlist, CFBundleDisplayName: flavor.name },
    },
    android: {
      ...appJson.expo.android,
      package: flavor.androidPackage,
    },
    extra: {
      ...appJson.expo.extra,
      flavor: flavorId,
      apiUrl: process.env.EXPO_PUBLIC_API_URL || appJson.expo.extra.apiUrl || "https://staging.vaidyagogate.org",
    },
  },
};

export default config;
