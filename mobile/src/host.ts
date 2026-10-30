/** Next.js host that serves `/api/mobile/*` on the Mumbai VPS. */
export const NEXT_API = "https://staging.vaidyagogate.org";
export const STAGING_SPELLING_API = "https://stagging.vaidyagogate.org";
export const DEMO_API = "https://demo.vaidyagogate.org";
export const DEFAULT_API = process.env.EXPO_PUBLIC_API_URL || NEXT_API;
export const FEED_ORIGINS = [
  DEFAULT_API,
  NEXT_API,
  STAGING_SPELLING_API,
  DEMO_API,
  "https://vaidyagogate.org",
  "https://www.vaidyagogate.org",
];
