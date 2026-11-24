import type { SiteTheme } from "@/lib/site-text";

export type FestivalPreset = {
  id: string;
  label: string;
  greeting: string;
  decor: string;
  /** Fixed-date festivals carry MM-DD defaults; lunar ones are dated by the desk each year. */
  fixed?: { start: string; end: string };
  colors: Partial<SiteTheme>;
};

export type FestivalSchedule = {
  id: string;
  enabled: boolean;
  start?: string;
  end?: string;
  greeting?: string;
};

export const festivalPresets: FestivalPreset[] = [
  {
    id: "makar-sankranti",
    label: "Makar Sankranti",
    greeting: "Happy Makar Sankranti",
    decor: "🪁 ☀️ 🪁",
    fixed: { start: "01-13", end: "01-15" },
    colors: { burgundy: "#B45309", burgundyDark: "#92400E", gold: "#D97706", saffron: "#EA580C", border: "#F3D9B1" },
  },
  {
    id: "republic-day",
    label: "Republic Day",
    greeting: "Happy Republic Day",
    decor: "🇮🇳 🇮🇳 🇮🇳",
    fixed: { start: "01-25", end: "01-27" },
    colors: { burgundy: "#E8711C", burgundyDark: "#C2570C", gold: "#138808", saffron: "#E8711C", ink: "#000080", trackGreen: "#138808" },
  },
  {
    id: "gudi-padwa",
    label: "Gudi Padwa",
    greeting: "Gudi Padwa and Navvarsh greetings",
    decor: "🎋 🌼 🎋",
    colors: { burgundy: "#B91C1C", burgundyDark: "#7F1D1D", gold: "#CA8A04", saffron: "#EA580C" },
  },
  {
    id: "holi",
    label: "Holi",
    greeting: "Happy Holi",
    decor: "🎨 🌸 🎨",
    colors: { burgundy: "#BE185D", burgundyDark: "#9D174D", gold: "#7C3AED", saffron: "#DB2777", trackGreen: "#7C3AED" },
  },
  {
    id: "independence-day",
    label: "Independence Day",
    greeting: "Happy Independence Day",
    decor: "🇮🇳 🇮🇳 🇮🇳",
    fixed: { start: "08-14", end: "08-16" },
    colors: { burgundy: "#E8711C", burgundyDark: "#C2570C", gold: "#138808", saffron: "#E8711C", ink: "#000080", trackGreen: "#138808" },
  },
  {
    id: "ganesh-chaturthi",
    label: "Ganesh Chaturthi",
    greeting: "Ganpati Bappa Morya",
    decor: "🌺 🪔 🌺",
    colors: { burgundy: "#C2410C", burgundyDark: "#9A3412", gold: "#D97706", saffron: "#EA580C", paper: "#FFF7ED", border: "#FAD7A8" },
  },
  {
    id: "navratri",
    label: "Navratri & Dussehra",
    greeting: "Navratri and Dussehra greetings",
    decor: "🌼 🔱 🌼",
    colors: { burgundy: "#B91C1C", burgundyDark: "#7F1D1D", gold: "#CA8A04", saffron: "#DC2626" },
  },
  {
    id: "ayurveda-day",
    label: "Dhanvantari Jayanti (Ayurveda Day)",
    greeting: "National Ayurveda Day greetings",
    decor: "🌿 🪔 🌿",
    colors: { burgundy: "#166534", burgundyDark: "#14532D", gold: "#A16207", saffron: "#15803D", trackGreen: "#166534" },
  },
  {
    id: "diwali",
    label: "Diwali",
    greeting: "Happy Diwali",
    decor: "🪔 ✨ 🪔",
    colors: { burgundy: "#9F1239", burgundyDark: "#701A33", gold: "#D4A017", saffron: "#C2410C", paper: "#FFF8E7", border: "#F1D99B" },
  },
  {
    id: "christmas",
    label: "Christmas",
    greeting: "Merry Christmas",
    decor: "🎄 ⭐ 🎄",
    fixed: { start: "12-24", end: "12-26" },
    colors: { burgundy: "#B91C1C", burgundyDark: "#7F1D1D", gold: "#15803D", saffron: "#166534", trackGreen: "#15803D" },
  },
  {
    id: "new-year",
    label: "New Year",
    greeting: "Happy New Year",
    decor: "🎉 ✨ 🎉",
    fixed: { start: "12-31", end: "01-01" },
    colors: { burgundy: "#1E3A8A", burgundyDark: "#172554", gold: "#CA8A04", saffron: "#1D4ED8" },
  },
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeFestivals(input: unknown): FestivalSchedule[] {
  if (!Array.isArray(input)) return [];
  const known = new Set(festivalPresets.map((preset) => preset.id));
  const seen = new Set<string>();
  const out: FestivalSchedule[] = [];
  for (const row of input as Partial<FestivalSchedule>[]) {
    if (!row || typeof row.id !== "string" || !known.has(row.id) || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push({
      id: row.id,
      enabled: row.enabled === true,
      start: typeof row.start === "string" && DAY.test(row.start) ? row.start : undefined,
      end: typeof row.end === "string" && DAY.test(row.end) ? row.end : undefined,
      greeting: typeof row.greeting === "string" && row.greeting.trim() ? row.greeting.trim().slice(0, 120) : undefined,
    });
  }
  return out;
}

/** Today's date in India as YYYY-MM-DD. */
export function indiaToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

function inWindow(today: string, start?: string, end?: string) {
  if (start && end && end < start) return today >= start || today <= end;
  return (!start || today >= start) && (!end || today <= end);
}

/** A switched-on festival with no dates runs now; with dates it runs only inside them. */
export function activeFestival(list: FestivalSchedule[] | undefined, today: string) {
  if (!today) return null;
  for (const row of list ?? []) {
    if (!row.enabled || !inWindow(today, row.start, row.end)) continue;
    const preset = festivalPresets.find((item) => item.id === row.id);
    if (preset) return { preset, greeting: row.greeting || preset.greeting };
  }
  return null;
}
