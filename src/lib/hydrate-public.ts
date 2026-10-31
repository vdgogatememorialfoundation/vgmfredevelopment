import { getSettings, saveSettings } from "@/lib/admin-store";
import { flyerKeys } from "@/lib/cms";
import { flyers as seededFlyers } from "@/data/content";
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
      if (dirty) {
        if (url.includes("/brand")) continue;
        return;
      }
      if (merged.publishedAt && appliedFeedAt() !== merged.publishedAt) {
        applyFeed(merged);
        setAppliedFeedAt(merged.publishedAt);
      }
      if (url.includes("/brand")) continue;
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
}
