"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALES, LOCALE_KEY, type Locale } from "@/lib/i18n/locales";
import { translate, type MessageKey } from "@/lib/i18n/messages";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function readLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_KEY) ?? "";
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(readLocale());
  }, []);

  useEffect(() => {
    const meta = LOCALES.find((item) => item.id === locale);
    document.documentElement.lang = meta?.html ?? "en-IN";
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  const value = useMemo<I18nValue>(() => {
    const setLocale = (next: Locale) => {
      window.localStorage.setItem(LOCALE_KEY, next);
      setLocaleState(next);
    };
    return {
      locale,
      setLocale,
      t: (key) => translate(locale, key),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => undefined,
      t: (key: MessageKey) => translate(DEFAULT_LOCALE, key),
    };
  }
  return context;
}
