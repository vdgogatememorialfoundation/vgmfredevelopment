import { SEMINAR_ADSENSE_CLIENT } from "@/lib/seminar-ads";
import { PRODUCTION_HOST } from "@/lib/platform";

/** The Foundation's approved AdSense publisher (same as ads.txt). */
export const ARTICLE_ADSENSE_CLIENT = SEMINAR_ADSENSE_CLIENT;
export const ARTICLE_ADSENSE_SCRIPT = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ARTICLE_ADSENSE_CLIENT}`;

export type ArticleAdPlacement = "top" | "inline" | "sidebar";

/** The in-article unit from AdSense, placed two paragraphs into each article. */
const IN_ARTICLE_SLOT = "6028411120";

/** Numeric AdSense ad-unit ids; the build env can override them. Without one, the page script still allows Auto ads. */
export function articleAdSlot(placement: ArticleAdPlacement) {
  const value =
    placement === "sidebar"
      ? process.env.NEXT_PUBLIC_ADSENSE_ARTICLE_SIDEBAR_SLOT
      : placement === "top"
        ? process.env.NEXT_PUBLIC_ADSENSE_ARTICLE_TOP_SLOT
        : process.env.NEXT_PUBLIC_ADSENSE_ARTICLE_SLOT || IN_ARTICLE_SLOT;
  const slot = (value || "").trim();
  return /^\d{6,20}$/.test(slot) ? slot : "";
}

export function articleAdsDisabled() {
  return (process.env.NEXT_PUBLIC_ARTICLE_ADS || "").trim().toLowerCase() === "off";
}

/** AdSense only serves on the approved domain, so staging and demo show a labelled placeholder instead. */
export function articleAdsLive(hostname: string) {
  const host = hostname.trim().toLowerCase();
  return host === PRODUCTION_HOST || host === `www.${PRODUCTION_HOST}`;
}
