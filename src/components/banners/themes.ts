import type { Banner } from "@/lib/cms/defaults";

export const BANNER_THEMES: Record<NonNullable<Banner["theme"]>, string> = {
  saffron: "from-[#c2410c] via-[#ea580c] to-[#f2a516]",
  turmeric: "from-[#f59e0b] via-[#f2a516] to-[#fb923c]",
  leaf: "from-[#2f8a3e] via-[#43a047] to-[#0f8b8d]",
  lotus: "from-[#e0457b] via-[#f06292] to-[#f97316]",
  peacock: "from-[#0f8b8d] via-[#14a3a5] to-[#2f8a3e]",
};

export function bannerTheme(theme: Banner["theme"]) {
  return BANNER_THEMES[theme ?? "saffron"] ?? BANNER_THEMES.saffron;
}
