export const colors = {
  burgundy: "#8F2D2D",
  burgundyDark: "#6A1F1F",
  gold: "#B8953A",
  ink: "#0B1F3A",
  inkSoft: "#16325C",
  paper: "#F7F3EA",
  muted: "#5C5648",
  border: "#E4D8C4",
  white: "#FFFFFF",
  background: "#FFFDF8",
};

/** Next.js host that actually serves `/api/mobile/*`. The public domain is still Wix. */
export const NEXT_API = "https://vgmfredevelopment.vercel.app";
export const DEFAULT_API = process.env.EXPO_PUBLIC_API_URL || NEXT_API;
export const FEED_ORIGINS = [DEFAULT_API, NEXT_API, "https://vaidyagogate.org", "https://www.vaidyagogate.org"];
