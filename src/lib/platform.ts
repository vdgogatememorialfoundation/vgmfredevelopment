export const PLATFORM_APPS = ["customer", "admin", "staff", "support"] as const;
export type PlatformApp = (typeof PLATFORM_APPS)[number];

export const PLATFORM_ENVIRONMENTS = ["staging", "demo", "production"] as const;
export type PlatformEnvironment = (typeof PLATFORM_ENVIRONMENTS)[number];

export const VPS_IPV4 = "89.116.32.1";
export const VPS_HOSTNAME = "srv1787209.hstgr.cloud";
export const APEX_DOMAIN = "vaidyagogate.org";

/** User-requested staging host spelling. */
export const STAGING_HOST = "stagging.vaidyagogate.org";
/** Existing DNS + TLS on the VPS. */
export const STAGING_ALIAS_HOST = "staging.vaidyagogate.org";
export const DEMO_HOST = "demo.vaidyagogate.org";
export const PRODUCTION_HOST = "vaidyagogate.org";

export const SISTER_SITES = ["fellowship", "autism", "seminar"] as const;
export type SisterSite = (typeof SISTER_SITES)[number];

export const FELLOWSHIP_HOST = "fellowship.vaidyagogate.org";
export const FELLOWSHIP_DEMO_HOST = "demo.fellowship.vaidyagogate.org";
export const AUTISM_HOST = "autism.vaidyagogate.org";
export const AUTISM_DEMO_HOST = "demo.autism.vaidyagogate.org";
export const SEMINAR_HOST = "seminar.vaidyagogate.org";
export const SEMINAR_DEMO_HOST = "demo.seminar.vaidyagogate.org";

export const SISTER_SITE_HOSTS: Record<SisterSite, { production: string; demo: string; productionPort: number; demoPort: number; label: string }> = {
  fellowship: { production: FELLOWSHIP_HOST, demo: FELLOWSHIP_DEMO_HOST, productionPort: 3009, demoPort: 3013, label: "Fellowship" },
  autism: { production: AUTISM_HOST, demo: AUTISM_DEMO_HOST, productionPort: 3003, demoPort: 3014, label: "Autism" },
  seminar: { production: SEMINAR_HOST, demo: SEMINAR_DEMO_HOST, productionPort: 3000, demoPort: 3010, label: "Seminar" },
};

export function publicSiteUrl() {
  const fromEnv = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return `https://${PRODUCTION_HOST}`;
}

export function platformEnv(): PlatformEnvironment | "local" {
  const value = (process.env.VGMF_ENV || process.env.NEXT_PUBLIC_VGMF_ENV || "").trim().toLowerCase();
  if (value === "demo" || value === "staging" || value === "production") return value;
  return "local";
}

export function isDemoEnv() {
  return platformEnv() === "demo";
}

export function isHostedEnv() {
  const env = platformEnv();
  return env === "demo" || env === "staging" || env === "production";
}

export function appStartPath(app: PlatformApp) {
  if (app === "admin") return "/admin";
  if (app === "staff") return "/staff";
  if (app === "support") return "/account/tickets";
  return "/";
}

export function originFromHost(host: string) {
  const trimmed = host.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return trimmed ? `https://${trimmed}` : "";
}
