"use client";

import { LOCALES } from "@/lib/i18n/locales";
import { useI18n } from "@/components/i18n/LanguageProvider";

export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className={`inline-flex items-center gap-1.5 ${tone === "dark" ? "text-stone-200" : "text-text-primary"}`}>
      <span className="sr-only">{t("lang.label")}</span>
      <select
        className={`rounded-md border bg-transparent px-1.5 py-1 text-xs ${
          tone === "dark" ? "border-white/20 text-stone-100" : "border-border text-text-primary"
        }`}
        value={locale}
        onChange={(event) => setLocale(event.target.value as typeof locale)}
        aria-label={t("lang.label")}
      >
        {LOCALES.map((item) => (
          <option key={item.id} value={item.id} className="text-ink">
            {item.native}
          </option>
        ))}
      </select>
    </label>
  );
}
