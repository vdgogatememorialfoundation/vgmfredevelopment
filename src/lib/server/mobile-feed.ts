import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { siteConfig } from "@/lib/constants";
import { defaultMobileAppConfig } from "@/lib/mobile-config";
import { type MobileFeed } from "@/lib/mobile-types";
import { listNotices } from "@/lib/server/notices";

export type { MobileFeed } from "@/lib/mobile-types";

const TMP_FILE = join("/tmp", "vgmf-mobile-snapshot.json");
const PUBLIC_FILE = join(process.cwd(), "public", "app-feed.json");

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
    gallery: [],
    about: null,
    policies: {},
    faqs: [],
  };
}

export function readMobileFeed(): MobileFeed {
  const snapshot = memory ?? readFile(TMP_FILE) ?? readFile(PUBLIC_FILE);
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
    },
    events: snapshot.events ?? base.events,
    articles: snapshot.articles ?? base.articles,
    books: snapshot.books ?? base.books,
    clinics: snapshot.clinics ?? base.clinics,
    videos: snapshot.videos ?? base.videos,
    notices: snapshot.notices?.length ? snapshot.notices : base.notices,
    announcements: snapshot.announcements ?? base.announcements,
    gallery: snapshot.gallery ?? base.gallery,
    about: snapshot.about ?? base.about,
    policies: { ...base.policies, ...snapshot.policies },
    faqs: snapshot.faqs ?? base.faqs,
    publishedAt: snapshot.publishedAt || base.publishedAt,
  };
}

export function saveMobileFeed(feed: MobileFeed) {
  memory = feed;
  for (const file of [TMP_FILE, PUBLIC_FILE]) {
    try {
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, JSON.stringify(feed));
    } catch {
      /* read-only host */
    }
  }
  return feed;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};
