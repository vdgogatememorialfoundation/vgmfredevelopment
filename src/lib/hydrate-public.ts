import { getSettings, saveSettings } from "@/lib/admin-store";
import { flyerKeys } from "@/lib/cms";
import { hydrateReviewsFromServer, replaceProductReviews, replaceSeminarReviews, type ProductReview } from "@/lib/reviews";
import { announcements as seededAnnouncements, flyers as seededFlyers, notices as seededNotices } from "@/data/content";
import { articles as seededArticles } from "@/data/articles";
import { events as seededEvents } from "@/data/events";
import { clinics as seededClinics } from "@/data/clinics";
import { videos as seededVideos } from "@/data/videos";
import { books as seededBooks } from "@/data/books";
import { appliedFeedAt, emptyFeedFallback, setAppliedFeedAt } from "@/lib/mobile-publish";
import type { MobileFeed } from "@/lib/mobile-types";
import type { Flyer } from "@/types";

const DIRTY_KEY = "vgmf_live_dirty";

let overlay: MobileFeed | null = null;

export function getPublishedFeed() {
  return overlay;
}

export function publishedStamp() {
  return overlay?.publishedAt ?? "";
}

export function setPublishedFeed(feed: MobileFeed | null) {
  overlay = feed;
  if (typeof window !== "undefined") window.dispatchEvent(new Event("vgmf-cms"));
}

function tryWrite(write: () => void) {
  try {
    write();
    return true;
  } catch {
    return false;
  }
}

/** Pull the published logo, name and slideshow onto this browser (phones included). */
export async function hydratePublishedSite() {
  if (typeof window === "undefined") return;
  void hydrateReviewsFromServer();
  const dirty = window.localStorage.getItem(DIRTY_KEY);
  const urls = ["/api/mobile/brand", "/api/mobile/feed", "/app-feed.json"];
  for (const url of urls) {
    try {
      const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) continue;
      const data = (await response.json()) as { feed?: MobileFeed; flyers?: MobileFeed["flyers"]; publishedAt?: string } & Partial<MobileFeed>;
      const site = data.feed?.site ?? data.site;
      if (!site) continue;
      const base = getPublishedFeed() ?? emptyFeedFallback();
      const full = data.feed?.site ? data.feed : Array.isArray(data.events) ? (data as MobileFeed) : null;
      const flyers = data.feed?.flyers ?? data.flyers;
      const merged: MobileFeed = {
        ...base,
        ...(full ?? {}),
        site: { ...base.site, ...site },
        flyers: flyers?.length ? flyers : base.flyers,
        publishedAt: data.feed?.publishedAt || data.publishedAt || base.publishedAt,
      };
      setPublishedFeed(merged);
      // Brand is only the logo and slideshow. Applying it would stamp the catalogue before books and events arrive.
      if (!full) {
        if (url.includes("/brand")) continue;
        return;
      }
      if (dirty) return;
      const feedAt = merged.publishedAt || "";
      const catalogueAt = window.localStorage.getItem(CATALOGUE_STAMP) ?? "";
      if (feedAt && appliedFeedAt() !== feedAt) {
        applyFeed(merged);
        setAppliedFeedAt(feedAt);
      } else if (feedAt && catalogueAt !== feedAt) {
        installPublishedCatalogue(merged);
      }
      return;
    } catch {
      /* try the next source */
    }
  }
}

function applyFeed(feed: MobileFeed) {
  const current = getSettings();
  tryWrite(() => {
    saveSettings({
      ...current,
      siteName: feed.site.name || current.siteName,
      tagline: feed.site.tagline || current.tagline,
      logoUrl: feed.site.logoUrl || current.logoUrl,
      logoText: feed.site.logoText || current.logoText,
      faviconUrl: feed.site.faviconUrl || current.faviconUrl,
      supportEmail: feed.site.email || current.supportEmail,
      supportPhone: feed.site.phone || current.supportPhone,
      social: { ...current.social, ...feed.site.social },
    });
  });

  const flyers = feed.flyers ?? [];
  if (flyers.length) {
    const seedIds = new Set(seededFlyers.map((item) => item.id));
    const custom = flyers.filter((item) => !seedIds.has(item.id));
    const edits = seededFlyers.map((seed) => {
      const match = flyers.find((item) => item.id === seed.id);
      return match ? { ...match, hidden: false } : { id: seed.id, hidden: true };
    });
    tryWrite(() => window.localStorage.setItem(flyerKeys.custom, JSON.stringify(custom)));
    tryWrite(() => window.localStorage.setItem(flyerKeys.edits, JSON.stringify(edits as Flyer[])));
  }

  if (feed.mobile) {
    tryWrite(() => window.localStorage.setItem("vgmf_mobile_app", JSON.stringify(feed.mobile)));
  }

  if (feed.platformCountries) {
    tryWrite(() => window.localStorage.setItem("vgmf_platform_countries", JSON.stringify(feed.platformCountries)));
  }

  if (feed.siteText) {
    tryWrite(() => window.localStorage.setItem("vgmf_site_text", JSON.stringify(feed.siteText)));
  }

  if (feed.seminarReviews?.length) {
    tryWrite(() => replaceSeminarReviews(feed.seminarReviews ?? []));
  }
  if (feed.productReviews?.length) {
    tryWrite(() => replaceProductReviews(feed.productReviews as ProductReview[]));
  }

  installPublishedCatalogue(feed);
}

const CATALOGUE_STAMP = "vgmf_feed_catalogue_at";

function splitSeed<T extends { id: string }>(seed: T[], incoming: T[]) {
  const seedIds = new Set(seed.map((item) => item.id));
  const custom = incoming.filter((item) => !seedIds.has(item.id));
  const edits = seed.map((item) => {
    const match = incoming.find((row) => row.id === item.id);
    return match ? { ...match, hidden: false } : { id: item.id, hidden: true };
  });
  return { custom, edits };
}

/** Phones and other browsers have no admin localStorage, so the published feed is the catalogue they see. */
function installPublishedCatalogue(feed: MobileFeed) {
  if (typeof window === "undefined") return;
  const fromFeed = window.localStorage.getItem(CATALOGUE_STAMP);
  const authoredHere = Boolean(
    window.localStorage.getItem("vgmf_custom_books") ||
      window.localStorage.getItem("vgmf_deleted_books") ||
      window.localStorage.getItem("vgmf_admin_products") ||
      window.localStorage.getItem("vgmf_custom_events") ||
      window.localStorage.getItem("vgmf_event_edits")
  );
  if (authoredHere && !fromFeed) return;

  const books = feed.books ?? [];
  if (books.length) {
    const present = new Set(books.map((book) => book.id));
    tryWrite(() => window.localStorage.setItem("vgmf_custom_books", JSON.stringify(books)));
    tryWrite(() =>
      window.localStorage.setItem(
        "vgmf_deleted_books",
        JSON.stringify(seededBooks.map((book) => book.id).filter((id) => !present.has(id)))
      )
    );
    tryWrite(() => window.localStorage.setItem("vgmf_admin_products", "[]"));
  }

  const writeSplit = <T extends { id: string }>(seed: T[], incoming: T[] | undefined, editsKey: string, customKey: string) => {
    if (!incoming?.length) return;
    const parts = splitSeed(seed, incoming);
    tryWrite(() => window.localStorage.setItem(customKey, JSON.stringify(parts.custom)));
    tryWrite(() => window.localStorage.setItem(editsKey, JSON.stringify(parts.edits)));
  };
  writeSplit(seededEvents, feed.events, "vgmf_event_edits", "vgmf_custom_events");
  writeSplit(seededArticles, feed.articles, "vgmf_article_edits", "vgmf_custom_articles");
  writeSplit(seededAnnouncements, feed.announcements, "vgmf_announcement_edits", "vgmf_custom_announcements");
  writeSplit(seededNotices, feed.notices, "vgmf_notice_edits", "vgmf_custom_notices");
  writeSplit(seededClinics, feed.clinics, "vgmf_clinic_edits", "vgmf_custom_clinics");
  writeSplit(seededVideos, feed.videos, "vgmf_video_edits", "vgmf_custom_videos");
  if (feed.gallery?.length) tryWrite(() => window.localStorage.setItem("vgmf_gallery", JSON.stringify(feed.gallery)));
  if (feed.about) tryWrite(() => window.localStorage.setItem("vgmf_about", JSON.stringify(feed.about)));
  if (feed.flags) tryWrite(() => window.localStorage.setItem("vgmf_site_flags", JSON.stringify(feed.flags)));
  if (feed.publishedAt) window.localStorage.setItem(CATALOGUE_STAMP, feed.publishedAt);
  window.dispatchEvent(new Event("vgmf-cms"));
}
