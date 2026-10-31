import { getAbout } from "@/lib/about";
import { defaultAppearance, getPublishedAppearance } from "@/lib/mobile-appearance";
import { getFaqs, getSettings } from "@/lib/admin-store";
import {
  getLiveAnnouncements,
  getLiveClinics,
  getLiveEvents,
  getLiveFlyers,
  getLiveNotices,
  getLiveVideos,
  getPublishedArticles,
  getSiteFlags,
} from "@/lib/cms";
import { siteConfig } from "@/lib/constants";
import { getGallery } from "@/lib/gallery";
import { defaultMobileAppConfig, getMobileAppConfig, type MobileAppConfig } from "@/lib/mobile-config";
import { getPolicies } from "@/lib/policies";
import { getLiveBooks } from "@/lib/product-data";
import { getSiteVisibility } from "@/lib/site-visibility";
import type { MobileFeed } from "@/lib/mobile-types";

/** Assemble the public app feed from the admin CMS in this browser. */
export function collectMobileSnapshot(): MobileFeed {
  const settings = getSettings();
  return {
    publishedAt: new Date().toISOString(),
    site: {
      name: settings.siteName || siteConfig.name,
      tagline: settings.tagline || siteConfig.tagline,
      logoUrl: settings.logoUrl || "/uploads/site-logo.png",
      logoText: settings.logoText || "",
      faviconUrl: settings.faviconUrl || settings.logoUrl || "/icon.png",
      email: settings.supportEmail || siteConfig.email,
      phone: settings.supportPhone || siteConfig.phone,
      address: siteConfig.address,
      social: settings.social ?? siteConfig.social,
    },
    flags: getSiteFlags(),
    visibility: getSiteVisibility().public,
    mobile: getMobileAppConfig(),
    events: getLiveEvents(),
    articles: getPublishedArticles(),
    books: getLiveBooks().filter((book) => book.active !== false),
    clinics: getLiveClinics(),
    videos: getLiveVideos(),
    notices: getLiveNotices(),
    announcements: getLiveAnnouncements(),
    flyers: getLiveFlyers(),
    gallery: getGallery(),
    about: getAbout(),
    policies: getPolicies(),
    faqs: getFaqs().filter((item) => item.active !== false),
    appearance: getPublishedAppearance(),
  };
}

export function emptyFeedFallback(mobile: MobileAppConfig = defaultMobileAppConfig): MobileFeed {
  return {
    publishedAt: "",
    site: {
      name: siteConfig.name,
      tagline: siteConfig.tagline,
      logoUrl: "/uploads/site-logo.png",
      logoText: "",
      faviconUrl: "/icon.png",
      email: siteConfig.email,
      phone: siteConfig.phone,
      address: siteConfig.address,
      social: siteConfig.social,
    },
    flags: { supportUs: false, supportUsTitle: "Support the Foundation", supportUsText: "", supportUsHref: "/contact" },
    visibility: {},
    mobile,
    events: [],
    articles: [],
    books: [],
    clinics: [],
    videos: [],
    notices: [],
    announcements: [],
    flyers: [],
    gallery: [],
    about: null,
    policies: {},
    faqs: [],
    appearance: defaultAppearance,
  };
}

const APPLIED_KEY = "vgmf_applied_feed_at";
const DIRTY_KEY = "vgmf_live_dirty";

export function markLiveDirty(dirty: boolean) {
  if (typeof window === "undefined") return;
  if (dirty) window.localStorage.setItem(DIRTY_KEY, "1");
  else window.localStorage.removeItem(DIRTY_KEY);
}

export function appliedFeedAt() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(APPLIED_KEY) ?? "";
}

export function setAppliedFeedAt(value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APPLIED_KEY, value);
}

/** Push only the header logo and slideshow so phones get branding even if the full snapshot is large. */
export function publishBrand() {
  if (typeof window === "undefined") return Promise.resolve({ ok: false as const });
  const snapshot = collectMobileSnapshot();
  return fetch("/api/mobile/brand", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ site: snapshot.site, flyers: snapshot.flyers }),
  })
    .then(async (response) => (await response.json().catch(() => null)) as { ok?: boolean; publishedAt?: string } | null)
    .then((data) => {
      if (data?.publishedAt) setAppliedFeedAt(data.publishedAt);
      return data ?? { ok: false as const };
    })
    .catch(() => ({ ok: false as const }));
}

/** Push logo, slideshow and other public CMS fields so phones and other browsers can load them. */
export function publishLiveSite() {
  if (typeof window === "undefined") return Promise.resolve({ ok: false as const });
  markLiveDirty(true);
  const snapshot = collectMobileSnapshot();
  return publishBrand()
    .then(() =>
      fetch("/api/mobile/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(snapshot),
      })
    )
    .then(async (response) => {
      const data = (await response.json().catch(() => null)) as { ok?: boolean; publishedAt?: string; error?: string } | null;
      if (data?.publishedAt) setAppliedFeedAt(data.publishedAt);
      return data ?? { ok: false as const };
    })
    .catch(() => ({ ok: false as const }))
    .finally(() => markLiveDirty(false));
}
