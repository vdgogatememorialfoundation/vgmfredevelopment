import { cleanChrome } from "@/lib/site-chrome";
import { getAbout } from "@/lib/about";
import { defaultAppearance, getPublishedAppearance } from "@/lib/mobile-appearance";
import { getFaqs, getSettings } from "@/lib/admin-store";
import { getLiveChatSettings } from "@/lib/live-chat";
import {
  getLiveAnnouncements,
  getLiveClinics,
  getLiveEvents,
  getLiveAwards,
  getLiveBanners,
  getLiveThanks,
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
import { clearPendingProducts, getAllProducts, pendingProductIds } from "@/lib/product-data";
import { getLiveCmsPages } from "@/lib/cms-pages";
import { getSiteVisibility } from "@/lib/site-visibility";
import { getPlatformCountries } from "@/lib/platform-countries";
import { getProductReviews, getSeminarReviews } from "@/lib/reviews";
import { getOrderSettings } from "@/lib/integrations";
import { getSiteText } from "@/lib/site-text";
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
      tickerSeconds: settings.tickerSeconds || 36,
      productText: settings.productText,
      shlokaBar: Boolean(settings.shlokaBar),
      shlokas: (settings.shlokas ?? []).map((line) => line.trim()).filter(Boolean),
      queryButton: Boolean(settings.queryButton),
      queryNumber: (settings.queryNumber ?? "").replace(/[^\d]/g, ""),
      queryMessage: (settings.queryMessage ?? "").trim(),
      maintenanceMode: Boolean(settings.maintenanceMode),
      maintenanceUntil: settings.maintenanceUntil || "",
      maintenanceMessage: settings.maintenanceMessage || "",
      chrome: cleanChrome(settings.chrome),
      liveChat: { enabled: Boolean(getLiveChatSettings().enabled), online: Boolean(getLiveChatSettings().online) },
    },
    flags: getSiteFlags(),
    visibility: getSiteVisibility().public,
    mobile: getMobileAppConfig(),
    events: getLiveEvents(),
    articles: getPublishedArticles(),
    books: getAllProducts().filter((book) => book.active !== false),
    clinics: getLiveClinics(),
    videos: getLiveVideos(),
    notices: getLiveNotices(),
    announcements: getLiveAnnouncements(),
    flyers: getLiveFlyers(),
    banners: getLiveBanners(),
    awards: getLiveAwards(),
    thanks: getLiveThanks(),
    gallery: getGallery(),
    about: getAbout(),
    policies: getPolicies(),
    faqs: getFaqs().filter((item) => item.active !== false),
    appearance: getPublishedAppearance(),
    platformCountries: getPlatformCountries(),
    seminarReviews: getSeminarReviews(),
    productReviews: getProductReviews(),
    siteText: getSiteText(),
    orderSettings: getOrderSettings(),
    pages: getLiveCmsPages(),
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
    banners: [],
    awards: [],
    thanks: [],
    gallery: [],
    about: null,
    policies: {},
    faqs: [],
    appearance: defaultAppearance,
    platformCountries: { allowInternational: true, enabledCountryCodes: [] },
    seminarReviews: [],
    productReviews: [],
  };
}

const APPLIED_KEY = "vgmf_applied_feed_at";
const DIRTY_KEY = "vgmf_live_dirty";

export function markLiveDirty(dirty: boolean) {
  if (typeof window === "undefined") return;
  if (dirty) window.localStorage.setItem(DIRTY_KEY, String(Date.now()));
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

const BASELINE_KEY = "vgmf_feed_section_hashes";

function hashText(text: string) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return `${text.length}:${hash >>> 0}`;
}

function sectionHashes(snapshot: MobileFeed) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (key === "publishedAt") continue;
    out[key] = hashText(JSON.stringify(value ?? null));
  }
  return out;
}

function readBaseline(): Record<string, string> | null {
  try {
    const raw = window.localStorage.getItem(BASELINE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

/** Remember this browser's content as matching the live feed, so later publishes send only what was edited here. */
export function recordFeedBaseline(snapshot: MobileFeed = collectMobileSnapshot()) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BASELINE_KEY, JSON.stringify(sectionHashes(snapshot)));
  } catch {
    /* storage full */
  }
}

export function hasFeedBaseline() {
  return typeof window !== "undefined" && readBaseline() !== null;
}

/**
 * Push the sections edited in this browser. A browser holding older content (another device, a fresh login)
 * never overwrites slides, banners or anything else it did not change.
 */
export function publishLiveSite(options: { removed?: Record<string, string[]> } = {}) {
  if (typeof window === "undefined") return Promise.resolve({ ok: false as const });
  markLiveDirty(true);
  const snapshot = collectMobileSnapshot();
  const baseline = readBaseline();
  const hashes = sectionHashes(snapshot);
  const sections = Object.fromEntries(
    Object.entries(snapshot).filter(([key]) => key !== "publishedAt" && (!baseline || baseline[key] !== hashes[key]))
  ) as Partial<MobileFeed>;
  // Without a baseline this browser never loaded the live feed, so only its own branding is safe to send.
  const body: Partial<MobileFeed> = baseline ? sections : { site: snapshot.site };
  for (const key of Object.keys(options.removed ?? {})) (body as Record<string, unknown>)[key] = (snapshot as Record<string, unknown>)[key];
  // Only the built-in slides means this browser never loaded the live slideshow; never send them over real banners.
  if (body.flyers && !options.removed?.flyers && body.flyers.every((flyer) => String(flyer.id).startsWith("slide-"))) delete body.flyers;
  // Products saved here always go out, even when an earlier feed load reset the baseline; the server takes just these ids.
  const editedBooks = pendingProductIds();
  if (editedBooks.length) body.books = snapshot.books;
  if (!Object.keys(body).length) {
    markLiveDirty(false);
    return Promise.resolve({ ok: true as const, publishedAt: appliedFeedAt(), unchanged: true });
  }
  return fetch("/api/mobile/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ partial: true, basedOn: appliedFeedAt(), sections: body, editedBooks, removed: options.removed }),
  })
    .then(async (response) => {
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        publishedAt?: string;
        previousAt?: string;
        rejected?: string[];
        error?: string;
      } | null;
      if (data?.ok && editedBooks.length && !data.rejected?.includes("books")) clearPendingProducts(editedBooks);
      const clean = !data?.rejected?.length && data?.previousAt === appliedFeedAt();
      // Only claim to be up to date when nobody else published in between; otherwise the next load pulls the live copy.
      if (data?.ok && data.publishedAt && clean) {
        setAppliedFeedAt(data.publishedAt);
        if (baseline) recordFeedBaseline(snapshot);
      }
      if (data?.rejected?.length) {
        window.dispatchEvent(new CustomEvent("vgmf-publish-conflict", { detail: data.rejected }));
      }
      return data ?? { ok: false as const };
    })
    .catch(() => ({ ok: false as const }))
    .finally(() => markLiveDirty(false));
}
