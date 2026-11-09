import { subscribeCms } from "@/lib/cms";
import { getPublishedFeed } from "@/lib/hydrate-public";
import type { MessageKey } from "@/lib/i18n/messages";
import { normalizeFestivals, type FestivalSchedule } from "@/lib/festival-themes";
import {
  defaultBirthday,
  defaultSignupControls,
  normalizeBirthday,
  normalizeDisclaimers,
  normalizeReels,
  normalizeSignup,
  type BirthdayControls,
  type InstagramReel,
  type SignupControls,
  type SiteDisclaimer,
} from "@/lib/site-extras";

const KEY = "vgmf_site_text";

export const homeSections = [
  { id: "hero", label: "Hero slideshow" },
  { id: "directory", label: "Events / Articles / Clinics shortcuts" },
  { id: "books", label: "Shop & publications" },
  { id: "events", label: "Events & programmes" },
  { id: "articles", label: "Articles" },
  { id: "notices", label: "Notice board" },
  { id: "clinics", label: "Clinics" },
  { id: "about", label: "About the Foundation" },
  { id: "reviews", label: "Seminar voices" },
  { id: "support", label: "Support Us" },
  { id: "speakers", label: "Speakers" },
  { id: "awards", label: "Awards" },
  { id: "legacy", label: "Legacy" },
  { id: "reels", label: "Instagram reels" },
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

export type SiteTheme = {
  burgundy: string;
  burgundyDark: string;
  gold: string;
  saffron: string;
  ink: string;
  inkSoft: string;
  paper: string;
  background: string;
  textPrimary: string;
  textMuted: string;
  border: string;
  trackGreen: string;
  trackLine: string;
  trackMuted: string;
  trackText: string;
  trackFailed: string;
  trackLink: string;
};

export type SiteText = {
  text: Partial<Record<MessageKey, string>>;
  pages: Record<string, PageCopy>;
  homeOrder: HomeSectionId[];
  homeHidden: Partial<Record<HomeSectionId, boolean>>;
  /** Keys are home:section, page:id, or account:/path. True shows an under-development notice. */
  developing: Partial<Record<string, boolean>>;
  reviews: ReviewsControls;
  theme: SiteTheme;
  festivals?: FestivalSchedule[];
  disclaimers?: SiteDisclaimer[];
  signup?: SignupControls;
  reels?: InstagramReel[];
  birthday?: BirthdayControls;
};

export const defaultSiteTheme: SiteTheme = {
  burgundy: "#8F2D2D",
  burgundyDark: "#6A1F1F",
  gold: "#B8953A",
  saffron: "#A67C2D",
  ink: "#0B1F3A",
  inkSoft: "#16325C",
  paper: "#F7F3EA",
  background: "#FFFDF8",
  textPrimary: "#0B1F3A",
  textMuted: "#5C5648",
  border: "#E4D8C4",
  trackGreen: "#067D62",
  trackLine: "#D5D9D9",
  trackMuted: "#565959",
  trackText: "#0F1111",
  trackFailed: "#C2410C",
  trackLink: "#007185",
};

export const themeFields: { title: string; hint: string; fields: { key: keyof SiteTheme; label: string }[] }[] = [
  {
    title: "Brand",
    hint: "Buttons, links, and the active item in the menu.",
    fields: [
      { key: "burgundy", label: "Primary" },
      { key: "burgundyDark", label: "Primary dark" },
      { key: "gold", label: "Gold" },
      { key: "saffron", label: "Saffron" },
    ],
  },
  {
    title: "Pages",
    hint: "Backgrounds, headings and body text on every public page.",
    fields: [
      { key: "background", label: "Page background" },
      { key: "paper", label: "Paper and cards" },
      { key: "ink", label: "Headings" },
      { key: "inkSoft", label: "Soft headings" },
      { key: "textPrimary", label: "Body text" },
      { key: "textMuted", label: "Muted text" },
      { key: "border", label: "Borders" },
    ],
  },
  {
    title: "Tracking",
    hint: "Application, order and shipment progress, including Certificate issued.",
    fields: [
      { key: "trackGreen", label: "Progress" },
      { key: "trackFailed", label: "Stopped or failed" },
      { key: "trackLine", label: "Upcoming line" },
      { key: "trackText", label: "Step titles" },
      { key: "trackMuted", label: "Step notes" },
      { key: "trackLink", label: "Links" },
    ],
  },
];

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeHex(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  if (!HEX.test(text)) return fallback;
  if (text.length === 4) {
    const [hash, r, g, b] = text;
    return `${hash}${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return text.toUpperCase();
}

export function normalizeTheme(input?: Partial<SiteTheme> | null): SiteTheme {
  const next = { ...defaultSiteTheme };
  if (!input || typeof input !== "object") return next;
  for (const key of Object.keys(next) as (keyof SiteTheme)[]) {
    next[key] = normalizeHex(input[key], next[key]);
  }
  return next;
}

export function themeCssVars(theme: SiteTheme): Record<string, string> {
  return {
    "--color-burgundy": theme.burgundy,
    "--color-burgundy-dark": theme.burgundyDark,
    "--color-gold": theme.gold,
    "--color-saffron": theme.saffron,
    "--color-ink": theme.ink,
    "--color-ink-soft": theme.inkSoft,
    "--color-paper": theme.paper,
    "--color-warm-cream": theme.paper,
    "--color-background": theme.background,
    "--color-text-primary": theme.textPrimary,
    "--color-text-muted": theme.textMuted,
    "--color-border": theme.border,
    "--tl-green": theme.trackGreen,
    "--tl-line": theme.trackLine,
    "--tl-muted": theme.trackMuted,
    "--tl-text": theme.trackText,
    "--tl-failed": theme.trackFailed,
    "--tl-link": theme.trackLink,
  };
}

export function applySiteTheme(theme: SiteTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(themeCssVars(theme))) root.style.setProperty(key, value);
}

export const themePresets: { id: string; label: string; theme: SiteTheme }[] = [
  { id: "original", label: "Original", theme: defaultSiteTheme },
  {
    id: "ocean",
    label: "Ocean",
    theme: {
      ...defaultSiteTheme,
      burgundy: "#0F4C81",
      burgundyDark: "#0A3358",
      gold: "#1D6A8A",
      saffron: "#0E7490",
      trackGreen: "#0F766E",
      trackLink: "#0F4C81",
    },
  },
  {
    id: "forest",
    label: "Forest",
    theme: {
      ...defaultSiteTheme,
      burgundy: "#1F6B4A",
      burgundyDark: "#145236",
      gold: "#3F7D4E",
      saffron: "#2F6B3A",
      trackGreen: "#1F6B4A",
      trackLink: "#145236",
    },
  },
  {
    id: "saffron",
    label: "Saffron",
    theme: {
      ...defaultSiteTheme,
      burgundy: "#9A3412",
      burgundyDark: "#7C2D12",
      gold: "#C2410C",
      saffron: "#B45309",
      trackGreen: "#C2410C",
      trackFailed: "#7F1D1D",
      trackLink: "#9A3412",
    },
  },
];

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
    developing: {},
    reviews: { ...defaultReviewsControls },
    theme: { ...defaultSiteTheme },
    festivals: [],
    disclaimers: [],
    signup: { ...defaultSignupControls, fields: [] },
    reels: [],
    birthday: { ...defaultBirthday },
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
    developing: Object.fromEntries(
      Object.entries(input.developing ?? {}).filter(([, value]) => value === true)
    ),
    reviews: {
      ...base.reviews,
      ...(input.reviews ?? {}),
      autoplaySeconds: Number.isFinite(seconds) ? Math.min(60, Math.max(0, Math.round(seconds))) : base.reviews.autoplaySeconds,
    },
    theme: normalizeTheme(input.theme),
    festivals: normalizeFestivals(input.festivals),
    disclaimers: normalizeDisclaimers(input.disclaimers),
    signup: normalizeSignup(input.signup),
    reels: normalizeReels(input.reels),
    birthday: normalizeBirthday(input.birthday),
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

export function developingKey(kind: "home" | "page" | "account", id: string) {
  return `${kind}:${id}`;
}

export function isDeveloping(kind: "home" | "page" | "account", id: string, text = getSiteText()) {
  return text.developing?.[developingKey(kind, id)] === true;
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
