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
