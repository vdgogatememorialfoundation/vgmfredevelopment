"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALE_KEY, type Locale } from "@/lib/i18n/locales";
import { translate, type MessageKey } from "@/lib/i18n/messages";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = "en-IN";
    document.documentElement.dataset.locale = DEFAULT_LOCALE;
    try {
      window.localStorage.removeItem(LOCALE_KEY);
    } catch {
      // Ignore storage access errors; English is already locked in memory.
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale: DEFAULT_LOCALE,
      setLocale: () => undefined,
      t: (key) => translate(DEFAULT_LOCALE, key),
    }),
    [],
  );

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
