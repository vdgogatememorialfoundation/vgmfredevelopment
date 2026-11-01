import { subscribeCms } from "@/lib/cms";
import { getPublishedFeed } from "@/lib/hydrate-public";
import type { MessageKey } from "@/lib/i18n/messages";

const KEY = "vgmf_site_text";

export const homeSections = [
  { id: "hero", label: "Hero slideshow" },
  { id: "directory", label: "Events / Articles / Clinics shortcuts" },
  { id: "about", label: "About the Foundation" },
  { id: "reviews", label: "Seminar voices" },
  { id: "support", label: "Support Us" },
  { id: "events", label: "Events & programmes" },
  { id: "legacy", label: "Legacy" },
  { id: "books", label: "Shop & publications" },
  { id: "articles", label: "Articles" },
  { id: "notices", label: "Notice board" },
  { id: "clinics", label: "Clinics" },
] as const;

export type HomeSectionId = (typeof homeSections)[number]["id"];

export type ReviewsTheme = "white" | "paper" | "navy";

export type ReviewsControls = {
  theme: ReviewsTheme;
  autoplaySeconds: number;
  showStars: boolean;
  showEvent: boolean;
  showPhoto: boolean;
  showArrows: boolean;
  showDots: boolean;
};

export type PageCopy = { eyebrow?: string; title?: string; description?: string };

export type SiteText = {
  text: Partial<Record<MessageKey, string>>;
  pages: Record<string, PageCopy>;
  homeOrder: HomeSectionId[];
  homeHidden: Partial<Record<HomeSectionId, boolean>>;
  reviews: ReviewsControls;
};

export const defaultReviewsControls: ReviewsControls = {
  theme: "white",
  autoplaySeconds: 7,
  showStars: true,
  showEvent: true,
  showPhoto: true,
  showArrows: true,
  showDots: true,
};

export function defaultSiteText(): SiteText {
  return {
    text: {},
    pages: {},
    homeOrder: homeSections.map((section) => section.id),
    homeHidden: {},
    reviews: { ...defaultReviewsControls },
  };
}

export function normalizeSiteText(input?: Partial<SiteText> | null): SiteText {
  const base = defaultSiteText();
  if (!input || typeof input !== "object") return base;
  const known = new Set<string>(base.homeOrder);
  const order = (Array.isArray(input.homeOrder) ? input.homeOrder : []).filter(
    (id, index, list): id is HomeSectionId => known.has(id) && list.indexOf(id) === index
  );
  for (const id of base.homeOrder) if (!order.includes(id)) order.push(id);
  const text = Object.fromEntries(
    Object.entries(input.text ?? {}).filter(([, value]) => typeof value === "string" && value.trim())
  ) as SiteText["text"];
  const seconds = Number(input.reviews?.autoplaySeconds);
  return {
    text,
    pages: input.pages && typeof input.pages === "object" ? input.pages : {},
    homeOrder: order,
    homeHidden: input.homeHidden && typeof input.homeHidden === "object" ? input.homeHidden : {},
    reviews: {
      ...base.reviews,
      ...(input.reviews ?? {}),
      autoplaySeconds: Number.isFinite(seconds) ? Math.min(60, Math.max(0, Math.round(seconds))) : base.reviews.autoplaySeconds,
    },
  };
}

let cacheRaw: string | null = "\0";
let cacheStamp = "";
let cacheValue: SiteText = defaultSiteText();

function localRaw() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Admin edits in this browser win; everyone else reads the published feed. */
export function getSiteText(): SiteText {
  const raw = localRaw();
  const published = getPublishedFeed();
  const stamp = published?.publishedAt ?? "";
  if (raw === cacheRaw && stamp === cacheStamp) return cacheValue;
  cacheRaw = raw;
  cacheStamp = stamp;
  let source: Partial<SiteText> | null | undefined = published?.siteText;
  if (raw) {
    try {
      source = JSON.parse(raw) as Partial<SiteText>;
    } catch {
      /* fall back to the published copy */
    }
  }
  cacheValue = normalizeSiteText(source);
  return cacheValue;
}

export function saveSiteText(next: SiteText) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(normalizeSiteText(next)));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function applyPublishedSiteText(value: Partial<SiteText> | undefined) {
  if (typeof window === "undefined" || !value) return;
  window.localStorage.setItem(KEY, JSON.stringify(normalizeSiteText(value)));
}

export function textOverride(key: MessageKey): string | undefined {
  return getSiteText().text[key];
}

export function pageCopy(path: string): PageCopy {
  const pages = getSiteText().pages;
  const clean = path.replace(/\/+$/, "") || "/";
  return pages[clean] ?? {};
}

export function siteTextVersion() {
  getSiteText();
  return `${cacheRaw ?? ""}|${cacheStamp}`;
}

export function subscribeSiteText(onChange: () => void) {
  return subscribeCms(onChange);
}

export function getPublishedSiteText(): SiteText {
  return normalizeSiteText(getPublishedFeed()?.siteText);
}
