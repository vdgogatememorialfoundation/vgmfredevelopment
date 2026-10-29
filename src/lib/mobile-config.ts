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
};

export const defaultMobileAppConfig: MobileAppConfig = {
  minVersion: "1.0.0",
  latestVersion: "1.0.0",
  forceUpdate: false,
  androidPackage: "org.vaidyagogate.app",
  iosBundle: "org.vaidyagogate.app",
  playStoreUrl: "",
  appStoreUrl: "",
  apiBaseUrl: "",
  modules: Object.fromEntries(mobileModules.map((item) => [item.id, true])) as Record<MobileModuleId, boolean>,
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
    };
  } catch {
    return defaultMobileAppConfig;
  }
}

export function saveMobileAppConfig(config: MobileAppConfig) {
  window.localStorage.setItem(MOBILE_APP_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event("vgmf-cms"));
}
