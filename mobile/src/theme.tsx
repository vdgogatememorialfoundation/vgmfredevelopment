import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  defaultAppearance,
  radiusValues,
  sanitizeAppearance,
  spacingValues,
  type MobileAppearance,
} from "./appearance";
import { fetchConfig } from "./api";
import { useFeed } from "./feed";

export { DEFAULT_API, FEED_ORIGINS, NEXT_API } from "./host";

export const colors = defaultAppearance.colors;

const CACHE_KEY = "vgmf-appearance";

export type ThemeTokens = {
  appearance: MobileAppearance;
  colors: MobileAppearance["colors"];
  radius: { sm: number; md: number; lg: number; pill: number };
  space: { xs: number; sm: number; md: number; lg: number; xl: number };
  type: MobileAppearance["typeScale"];
  fontFamily: string | undefined;
  columns: 1 | 2;
  labels: MobileAppearance["labels"];
  section: (id: MobileAppearance["homeSections"][number]["id"]) => MobileAppearance["homeSections"][number] | undefined;
};

function tokensFor(appearance: MobileAppearance): ThemeTokens {
  return {
    appearance,
    colors: appearance.colors,
    radius: radiusValues[appearance.radiusPreset],
    space: spacingValues[appearance.spacingPreset],
    type: appearance.typeScale,
    fontFamily: appearance.fontFamily === "serif" ? "Georgia" : undefined,
    columns: appearance.productColumns,
    labels: appearance.labels,
    section: (id) => appearance.homeSections.find((item) => item.id === id),
  };
}

const ThemeContext = createContext<ThemeTokens>(tokensFor(defaultAppearance));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { feed, refresh } = useFeed();
  const [appearance, setAppearance] = useState(defaultAppearance);

  const apply = useCallback((value: unknown) => {
    const next = sanitizeAppearance(value);
    setAppearance((current) => {
      if (current.version > next.version && current.publishedAt && next.publishedAt && current.publishedAt > next.publishedAt) {
        return current;
      }
      void SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  useEffect(() => {
    void SecureStore.getItemAsync(CACHE_KEY)
      .then((raw) => {
        if (raw) setAppearance(sanitizeAppearance(JSON.parse(raw)));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!feed?.appearance) return;
    apply(feed.appearance);
  }, [apply, feed?.appearance, feed?.publishedAt]);

  useEffect(() => {
    let last = 0;
    const pull = () => {
      const now = Date.now();
      if (now - last < 60_000) return;
      last = now;
      void fetchConfig()
        .then((payload) => {
          if (payload?.appearance) apply(payload.appearance);
        })
        .catch(() => undefined);
    };
    pull();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        pull();
        void refresh();
      }
    });
    return () => sub.remove();
  }, [apply, refresh]);

  const value = useMemo(() => tokensFor(appearance), [appearance]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
