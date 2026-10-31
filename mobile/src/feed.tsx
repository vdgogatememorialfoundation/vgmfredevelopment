import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { fetchFeed, fetchLiveNotices, loadSession, type Feed, type Row } from "./api";
import { currentFlavor } from "./flavor";
import { SITE } from "./site-content";

type FeedContextValue = {
  feed: Feed | null;
  notices: Row[];
  loading: boolean;
  error: string;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
};

const FeedContext = createContext<FeedContextValue | null>(null);

export function FeedProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [notices, setNotices] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    setError("");
    if (!opts?.silent) setLoading(true);
    try {
      await loadSession();
      const next = await fetchFeed();
      setFeed(next);
      try {
        setNotices(await fetchLiveNotices());
      } catch {
        setNotices(next.notices ?? []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh({ silent: true });
    }, 30_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh({ silent: true });
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  return <FeedContext.Provider value={{ feed, notices, loading, error, refresh }}>{children}</FeedContext.Provider>;
}

export function useFeed() {
  const value = useContext(FeedContext);
  if (!value) throw new Error("FeedProvider missing");
  return value;
}

export function useBrand() {
  const { feed } = useFeed();
  const flavor = currentFlavor();
  const brand = feed?.mobile?.apps?.[flavor.id];
  const raw = String(brand?.name || feed?.site.name || flavor.displayName).trim();
  const name =
    flavor.id === "customer" || /^(vgmf|vgmf foundation|foundation live)$/i.test(raw) ? SITE.name : raw || SITE.name;
  return {
    name,
    logoUrl: brand?.logoUrl || feed?.site.logoUrl || "",
    tagline: feed?.site.tagline || "",
  };
}

export function useEnabled(id: string) {
  const { feed } = useFeed();
  if (!feed) return true;
  if (feed.visibility?.[id] === false) return false;
  if (feed.mobile?.modules?.[id] === false) return false;
  return true;
}
