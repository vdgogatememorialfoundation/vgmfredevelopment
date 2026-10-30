import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { siteConfig } from "@/lib/constants";
import { writePublishedFeed } from "@/lib/server/db";
import { dataFile } from "@/lib/server/paths";
import { defaultAppearance, sanitizeAppearance } from "@/lib/mobile-appearance";
import { defaultMobileAppConfig } from "@/lib/mobile-config";
import { type MobileFeed } from "@/lib/mobile-types";
import { listNotices } from "@/lib/server/notices";

export type { MobileFeed } from "@/lib/mobile-types";

const TMP_FILE = join("/tmp", "vgmf-mobile-snapshot.json");
const PUBLIC_FILE = join(process.cwd(), "public", "app-feed.json");
const DATA_FILE = dataFile("app-feed.json");

let memory: MobileFeed | null = null;

function readFile(path: string): MobileFeed | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as MobileFeed;
    if (parsed && typeof parsed === "object" && parsed.site) return parsed;
  } catch {
    /* missing */
  }
  return null;
}

export function defaultMobileFeed(): MobileFeed {
  const notices = listNotices();
  return {
    publishedAt: "",
    site: {
      name: siteConfig.name,
      tagline: siteConfig.tagline,
      logoUrl: "",
      logoText: "",
      faviconUrl: "",
      email: siteConfig.email,
      phone: siteConfig.phone,
      address: siteConfig.address,
      social: siteConfig.social,
    },
    flags: {
      supportUs: false,
      supportUsTitle: "Support the Foundation",
      supportUsText: "Contributions help clinics, teaching and publications continue.",
      supportUsHref: "/contact",
    },
    visibility: {},
    mobile: defaultMobileAppConfig,
    events: [],
    articles: [],
    books: [],
    clinics: [],
    videos: [],
    notices,
    announcements: [],
    flyers: [],
    gallery: [],
    about: null,
    policies: {},
    faqs: [],
    appearance: defaultAppearance,
  };
}

export function readMobileFeed(): MobileFeed {
  const snapshot = memory ?? readFile(DATA_FILE) ?? readFile(TMP_FILE) ?? readFile(PUBLIC_FILE);
  const base = defaultMobileFeed();
  if (!snapshot) return base;
  return {
    ...base,
    ...snapshot,
    site: { ...base.site, ...snapshot.site },
    flags: { ...base.flags, ...snapshot.flags },
    visibility: { ...base.visibility, ...snapshot.visibility },
    mobile: {
      ...base.mobile,
      ...snapshot.mobile,
      modules: { ...base.mobile.modules, ...snapshot.mobile?.modules },
      apps: {
        customer: { ...base.mobile.apps.customer, ...snapshot.mobile?.apps?.customer },
        admin: { ...base.mobile.apps.admin, ...snapshot.mobile?.apps?.admin },
        staff: { ...base.mobile.apps.staff, ...snapshot.mobile?.apps?.staff },
        support: { ...base.mobile.apps.support, ...snapshot.mobile?.apps?.support },
      },
      showPublicDownload: snapshot.mobile?.showPublicDownload === true,
    },
    events: snapshot.events ?? base.events,
    articles: snapshot.articles ?? base.articles,
    books: snapshot.books ?? base.books,
    clinics: snapshot.clinics ?? base.clinics,
    videos: snapshot.videos ?? base.videos,
    notices: snapshot.notices?.length ? snapshot.notices : base.notices,
    announcements: snapshot.announcements ?? base.announcements,
    flyers: snapshot.flyers ?? base.flyers,
    gallery: snapshot.gallery ?? base.gallery,
    about: snapshot.about ?? base.about,
    policies: { ...base.policies, ...snapshot.policies },
    faqs: snapshot.faqs ?? base.faqs,
    publishedAt: snapshot.publishedAt || base.publishedAt,
    appearance: sanitizeAppearance(snapshot.appearance ?? base.appearance ?? defaultAppearance),
  };
}

function persistDataUrl(value: string | undefined, name: string) {
  if (!value) return value ?? "";
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return value;
  const mime = match[1].toLowerCase();
  const ext = mime.includes("svg") ? "svg" : mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : "jpg";
  const file = `${name}.${ext}`;
  const dest = join(process.cwd(), "public", "uploads", file);
  try {
    mkdirSync(join(dest, ".."), { recursive: true });
    writeFileSync(dest, Buffer.from(match[2].replace(/\s/g, ""), "base64"));
    return `/uploads/${file}`;
  } catch {
    return value;
  }
}

function persistFeedAssets(feed: MobileFeed): MobileFeed {
  const apps = { ...defaultMobileAppConfig.apps, ...feed.mobile?.apps };
  return {
    ...feed,
    site: {
      ...feed.site,
      logoUrl: persistDataUrl(feed.site?.logoUrl, "site-logo"),
      faviconUrl: persistDataUrl(feed.site?.faviconUrl, "site-favicon"),
    },
    flyers: (feed.flyers ?? []).map((flyer, index) => ({
      ...flyer,
      image: persistDataUrl(flyer.image, `flyer-${String(flyer.id || index).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || index}`),
    })),
    mobile: {
      ...defaultMobileAppConfig,
      ...feed.mobile,
      apps: {
        customer: { ...apps.customer, logoUrl: persistDataUrl(apps.customer?.logoUrl, "app-customer") },
        admin: { ...apps.admin, logoUrl: persistDataUrl(apps.admin?.logoUrl, "app-admin") },
        staff: { ...apps.staff, logoUrl: persistDataUrl(apps.staff?.logoUrl, "app-staff") },
        support: { ...apps.support, logoUrl: persistDataUrl(apps.support?.logoUrl, "app-support") },
      },
    },
  };
}

export function saveMobileFeed(feed: MobileFeed) {
  memory = persistFeedAssets(feed);
  for (const file of [DATA_FILE, TMP_FILE, PUBLIC_FILE]) {
    try {
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, JSON.stringify(memory));
    } catch {
      /* read-only host */
    }
  }
  void writePublishedFeed(memory).catch(() => undefined);
  return memory;
}

export function mergePublishedBrand(partial: { site?: Partial<MobileFeed["site"]>; flyers?: MobileFeed["flyers"] }) {
  const current = readMobileFeed();
  const patch = Object.fromEntries(
    Object.entries(partial.site ?? {}).filter(([, value]) => value != null && String(value).length > 0)
  ) as Partial<MobileFeed["site"]>;
  return saveMobileFeed({
    ...current,
    publishedAt: new Date().toISOString(),
    site: { ...current.site, ...patch },
    flyers: partial.flyers ?? current.flyers,
  });
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};
