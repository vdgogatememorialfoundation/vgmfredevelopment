/** Next.js host that actually serves `/api/mobile/*`. The public domain is still Wix. */
export const NEXT_API = "https://vgmfredevelopment.vercel.app";
export const DEFAULT_API = process.env.EXPO_PUBLIC_API_URL || NEXT_API;
export const FEED_ORIGINS = [DEFAULT_API, NEXT_API, "https://vaidyagogate.org", "https://www.vaidyagogate.org"];
