const DRAFT_KEY = "vgmf_mobile_appearance_draft";
const PUBLISHED_KEY = "vgmf_mobile_appearance_published";

export const HOME_SECTION_IDS = [
  "carousel",
  "categories",
  "events",
  "shop",
  "articles",
  "videos",
  "gallery",
  "notices",
  "about",
  "support",
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];
export type FontChoice = "system" | "serif";
export type RadiusPreset = "compact" | "standard" | "soft";
export type SpacingPreset = "compact" | "standard" | "relaxed";

export type AppearanceColors = {
  primary: string;
  onPrimary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  paper: string;
  text: string;
  muted: string;
  border: string;
};

export type HomeSectionConfig = {
  id: HomeSectionId;
  visible: boolean;
  title: string;
  subtitle: string;
};

export type MobileAppearance = {
  version: number;
  publishedAt: string;
  colors: AppearanceColors;
  fontFamily: FontChoice;
  typeScale: {
    title: number;
    heading: number;
    body: number;
    caption: number;
  };
  radiusPreset: RadiusPreset;
  spacingPreset: SpacingPreset;
  productColumns: 1 | 2;
  carouselAspect: "1:1";
  homeSections: HomeSectionConfig[];
  labels: {
    searchPlaceholder: string;
    bag: string;
    shop: string;
    events: string;
    clinics: string;
    notices: string;
  };
};

const HEX = /^#([0-9A-Fa-f]{6})$/;

export const defaultAppearance: MobileAppearance = {
  version: 1,
  publishedAt: "",
  colors: {
    primary: "#8F2D2D",
    onPrimary: "#FFFFFF",
    secondary: "#0B1F3A",
    accent: "#B8953A",
    background: "#F7F3EA",
    surface: "#FFFDF8",
    paper: "#FFFFFF",
    text: "#0B1F3A",
    muted: "#5C5648",
    border: "#E4D8C4",
  },
  fontFamily: "system",
  typeScale: { title: 22, heading: 17, body: 15, caption: 12 },
  radiusPreset: "standard",
  spacingPreset: "standard",
  productColumns: 2,
  carouselAspect: "1:1",
  homeSections: [
    { id: "carousel", visible: true, title: "", subtitle: "" },
    { id: "categories", visible: true, title: "Explore", subtitle: "" },
    { id: "events", visible: true, title: "Upcoming events", subtitle: "" },
    { id: "shop", visible: true, title: "Publications", subtitle: "" },
    { id: "articles", visible: true, title: "From the library", subtitle: "" },
    { id: "videos", visible: true, title: "Videos", subtitle: "" },
    { id: "gallery", visible: true, title: "Gallery", subtitle: "" },
    { id: "notices", visible: true, title: "Notice board", subtitle: "" },
    { id: "about", visible: true, title: "The Foundation", subtitle: "" },
    { id: "support", visible: true, title: "Support the Foundation", subtitle: "" },
  ],
  labels: {
    searchPlaceholder: "Search publications, events and clinics",
    bag: "Bag",
    shop: "Publications",
    events: "Events",
    clinics: "Clinics",
    notices: "Notice board",
  },
};

export const radiusValues: Record<RadiusPreset, { sm: number; md: number; lg: number; pill: number }> = {
  compact: { sm: 8, md: 12, lg: 16, pill: 999 },
  standard: { sm: 10, md: 14, lg: 18, pill: 999 },
  soft: { sm: 14, md: 18, lg: 24, pill: 999 },
};

export const spacingValues: Record<SpacingPreset, { xs: number; sm: number; md: number; lg: number; xl: number }> = {
  compact: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  standard: { xs: 4, sm: 8, md: 16, lg: 20, xl: 32 },
  relaxed: { xs: 6, sm: 12, md: 20, lg: 28, xl: 40 },
};

function hex(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return HEX.test(text) ? text.toUpperCase().replace(/^#/, "#") : fallback;
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function sectionId(value: unknown): HomeSectionId | null {
  return HOME_SECTION_IDS.includes(value as HomeSectionId) ? (value as HomeSectionId) : null;
}

export function sanitizeAppearance(input: unknown): MobileAppearance {
  const raw = input && typeof input === "object" ? (input as Partial<MobileAppearance>) : {};
  const colorsIn = (raw.colors ?? {}) as Partial<AppearanceColors>;
  const scaleIn = (raw.typeScale ?? {}) as Partial<MobileAppearance["typeScale"]>;
  const labelsIn = (raw.labels ?? {}) as Partial<MobileAppearance["labels"]>;
  const seen = new Set<HomeSectionId>();
  const sections: HomeSectionConfig[] = [];
  for (const item of Array.isArray(raw.homeSections) ? raw.homeSections : []) {
    const id = sectionId((item as HomeSectionConfig)?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const fallback = defaultAppearance.homeSections.find((section) => section.id === id)!;
    sections.push({
      id,
      visible: (item as HomeSectionConfig).visible !== false,
      title: String((item as HomeSectionConfig).title ?? fallback.title).slice(0, 80),
      subtitle: String((item as HomeSectionConfig).subtitle ?? fallback.subtitle).slice(0, 160),
    });
  }
  for (const fallback of defaultAppearance.homeSections) {
    if (!seen.has(fallback.id)) sections.push({ ...fallback });
  }
  return {
    version: clamp(raw.version, 1, 1_000_000, defaultAppearance.version),
    publishedAt: String(raw.publishedAt ?? "").slice(0, 40),
    colors: {
      primary: hex(colorsIn.primary, defaultAppearance.colors.primary),
      onPrimary: hex(colorsIn.onPrimary, defaultAppearance.colors.onPrimary),
      secondary: hex(colorsIn.secondary, defaultAppearance.colors.secondary),
      accent: hex(colorsIn.accent, defaultAppearance.colors.accent),
      background: hex(colorsIn.background, defaultAppearance.colors.background),
      surface: hex(colorsIn.surface, defaultAppearance.colors.surface),
      paper: hex(colorsIn.paper, defaultAppearance.colors.paper),
      text: hex(colorsIn.text, defaultAppearance.colors.text),
      muted: hex(colorsIn.muted, defaultAppearance.colors.muted),
      border: hex(colorsIn.border, defaultAppearance.colors.border),
    },
    fontFamily: raw.fontFamily === "serif" ? "serif" : "system",
    typeScale: {
      title: clamp(scaleIn.title, 18, 32, defaultAppearance.typeScale.title),
      heading: clamp(scaleIn.heading, 14, 24, defaultAppearance.typeScale.heading),
      body: clamp(scaleIn.body, 13, 20, defaultAppearance.typeScale.body),
      caption: clamp(scaleIn.caption, 10, 16, defaultAppearance.typeScale.caption),
    },
    radiusPreset: raw.radiusPreset === "compact" || raw.radiusPreset === "soft" ? raw.radiusPreset : "standard",
    spacingPreset: raw.spacingPreset === "compact" || raw.spacingPreset === "relaxed" ? raw.spacingPreset : "standard",
    productColumns: raw.productColumns === 1 ? 1 : 2,
    carouselAspect: "1:1",
    homeSections: sections,
    labels: {
      searchPlaceholder: String(labelsIn.searchPlaceholder || defaultAppearance.labels.searchPlaceholder).slice(0, 80),
      bag: String(labelsIn.bag || defaultAppearance.labels.bag).slice(0, 24),
      shop: String(labelsIn.shop || defaultAppearance.labels.shop).slice(0, 32),
      events: String(labelsIn.events || defaultAppearance.labels.events).slice(0, 32),
      clinics: String(labelsIn.clinics || defaultAppearance.labels.clinics).slice(0, 32),
      notices: String(labelsIn.notices || defaultAppearance.labels.notices).slice(0, 32),
    },
  };
}

function readLocal(key: string): MobileAppearance | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? sanitizeAppearance(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function getAppearanceDraft(): MobileAppearance {
  return readLocal(DRAFT_KEY) ?? getPublishedAppearance();
}

export function getPublishedAppearance(): MobileAppearance {
  return readLocal(PUBLISHED_KEY) ?? defaultAppearance;
}

export function saveAppearanceDraft(value: MobileAppearance) {
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(sanitizeAppearance(value)));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function publishAppearanceDraft(value: MobileAppearance) {
  const next = sanitizeAppearance({
    ...value,
    version: Math.max(getPublishedAppearance().version, value.version || 0) + 1,
    publishedAt: new Date().toISOString(),
  });
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  window.localStorage.setItem(PUBLISHED_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("vgmf-cms"));
  return next;
}

export function restoreAppearanceDefaults() {
  window.localStorage.removeItem(DRAFT_KEY);
  window.dispatchEvent(new Event("vgmf-cms"));
  return defaultAppearance;
}

export function publicAppearancePayload(appearance: MobileAppearance) {
  const safe = sanitizeAppearance(appearance);
  return {
    version: safe.version,
    publishedAt: safe.publishedAt,
    colors: safe.colors,
    fontFamily: safe.fontFamily,
    typeScale: safe.typeScale,
    radiusPreset: safe.radiusPreset,
    spacingPreset: safe.spacingPreset,
    productColumns: safe.productColumns,
    carouselAspect: safe.carouselAspect,
    homeSections: safe.homeSections,
    labels: safe.labels,
  };
}
