/** AdSense for the seminar recordings page only. This publisher id is public page source. */
export const SEMINAR_ADSENSE_CLIENT = "ca-pub-8311884562432306";
export const SEMINAR_ADSENSE_SCRIPT = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SEMINAR_ADSENSE_CLIENT}`;

/** Same publisher, in the AdSense for video client form used by the IMA SDK. */
const VIDEO_CLIENT = "ca-video-pub-8311884562432306";

/** videoad_start_delay is milliseconds: 0 pre-roll, -1 post-roll, otherwise the mid-roll offset. */
export function seminarVideoAdTag(pageUrl: string, when: "pre" | "mid" | "post", offsetMs = 0) {
  const delay = when === "pre" ? "0" : when === "post" ? "-1" : String(Math.max(1, Math.round(offsetMs)));
  const params = new URLSearchParams({
    ad_type: "video",
    client: VIDEO_CLIENT,
    description_url: pageUrl,
    videoad_start_delay: delay,
    hl: "en",
  });
  return `https://googleads.g.doubleclick.net/pagead/ads?${params.toString()}`;
}

/** A seminar-office tag is used only when it is a Google ad tag. */
export function seminarSavedTag(saved?: string) {
  const tag = (saved || "").trim();
  if (tag.startsWith("https://googleads.g.doubleclick.net/") || tag.startsWith("https://pubads.g.doubleclick.net/")) return tag;
  return "";
}

export function seminarAdTag(saved: string | undefined, pageUrl: string, when: "pre" | "mid" | "post", offsetMs = 0) {
  return seminarSavedTag(saved) || seminarVideoAdTag(pageUrl, when, offsetMs);
}

/** The Foundation's in-article unit, used when the seminar office has not saved its own slot. */
export const SEMINAR_DEFAULT_SLOT = "6028411120";

/** Banner slot for this publisher; ads show unless the seminar office switches them off. */
export function seminarDisplaySlot(ads?: { enabled?: boolean; adsenseClient?: string; adsenseSlot?: string }) {
  if (ads?.enabled === false) return "";
  const client = (ads?.adsenseClient || "").trim();
  if (client && client !== SEMINAR_ADSENSE_CLIENT) return "";
  const slot = (ads?.adsenseSlot || "").trim();
  return /^\d{6,20}$/.test(slot) ? slot : SEMINAR_DEFAULT_SLOT;
}
