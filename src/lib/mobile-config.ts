export const MOBILE_APP_KEY = "vgmf_mobile_app";

export type MobileModuleId =
  | "home"
  | "events"
  | "articles"
  | "shop"
  | "clinics"
  | "videos"
  | "gallery"
  | "notices"
  | "about"
  | "support"
  | "certificates"
  | "account";

export const mobileModules: { id: MobileModuleId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "events", label: "Events" },
  { id: "articles", label: "Articles" },
  { id: "shop", label: "Shop" },
  { id: "clinics", label: "Clinics" },
  { id: "videos", label: "Videos" },
  { id: "gallery", label: "Gallery" },
  { id: "notices", label: "Notices" },
  { id: "about", label: "About" },
  { id: "support", label: "Support" },
  { id: "certificates", label: "Certificate verification" },
  { id: "account", label: "Account" },
];

export type AppFlavorId = "customer" | "admin" | "staff" | "support";

export type MobileAppBrand = {
  name: string;
  logoUrl: string;
};

export const appFlavors: {
  id: AppFlavorId;
  label: string;
  defaultName: string;
  androidPackage: string;
  iosBundle: string;
  startPath: string;
  download: string;
}[] = [
  { id: "customer", label: "Customer app", defaultName: "VGMF", androidPackage: "org.vaidyagogate.customer", iosBundle: "org.vaidyagogate.customer", startPath: "/", download: "/api/mobile/apk/customer" },
  { id: "admin", label: "Admin app", defaultName: "VGMF Admin", androidPackage: "org.vaidyagogate.admin", iosBundle: "org.vaidyagogate.admin", startPath: "/admin", download: "/api/mobile/apk/admin" },
  { id: "staff", label: "Staff app", defaultName: "VGMF Staff", androidPackage: "org.vaidyagogate.staff", iosBundle: "org.vaidyagogate.staff", startPath: "/staff", download: "/api/mobile/apk/staff" },
  { id: "support", label: "Support app", defaultName: "VGMF Support", androidPackage: "org.vaidyagogate.support", iosBundle: "org.vaidyagogate.support", startPath: "/account/tickets", download: "/api/mobile/apk/support" },
];

export const defaultAppBrands: Record<AppFlavorId, MobileAppBrand> = {
  customer: { name: "VGMF", logoUrl: "" },
  admin: { name: "VGMF Admin", logoUrl: "" },
  staff: { name: "VGMF Staff", logoUrl: "" },
  support: { name: "VGMF Support", logoUrl: "" },
};

export type MobileAppConfig = {
  minVersion: string;
  latestVersion: string;
  forceUpdate: boolean;
  androidPackage: string;
  iosBundle: string;
  playStoreUrl: string;
  appStoreUrl: string;
  /** Optional override; the installed app already knows the website origin. */
  apiBaseUrl: string;
  modules: Record<MobileModuleId, boolean>;
  /** Live name and logo for each installed app. Changing these does not need a Play Store release. */
  apps: Record<AppFlavorId, MobileAppBrand>;
};

export const defaultMobileAppConfig: MobileAppConfig = {
  minVersion: "1.0.0",
  latestVersion: "1.0.0",
  forceUpdate: false,
  androidPackage: "org.vaidyagogate.customer",
  iosBundle: "org.vaidyagogate.customer",
  playStoreUrl: "",
  appStoreUrl: "",
  apiBaseUrl: "",
  modules: Object.fromEntries(mobileModules.map((item) => [item.id, true])) as Record<MobileModuleId, boolean>,
  apps: defaultAppBrands,
};

export function getMobileAppConfig(): MobileAppConfig {
  if (typeof window === "undefined") return defaultMobileAppConfig;
  try {
    const raw = window.localStorage.getItem(MOBILE_APP_KEY);
    if (!raw) return defaultMobileAppConfig;
    const saved = JSON.parse(raw) as Partial<MobileAppConfig>;
    return {
      ...defaultMobileAppConfig,
      ...saved,
      modules: { ...defaultMobileAppConfig.modules, ...(saved.modules ?? {}) },
      apps: {
        customer: { ...defaultAppBrands.customer, ...saved.apps?.customer },
        admin: { ...defaultAppBrands.admin, ...saved.apps?.admin },
        staff: { ...defaultAppBrands.staff, ...saved.apps?.staff },
        support: { ...defaultAppBrands.support, ...saved.apps?.support },
      },
    };
  } catch {
    return defaultMobileAppConfig;
  }
}

export function saveMobileAppConfig(config: MobileAppConfig) {
  window.localStorage.setItem(MOBILE_APP_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event("vgmf-cms"));
}
