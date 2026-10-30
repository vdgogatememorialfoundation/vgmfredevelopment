import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchFeed, fetchLiveNotices, loadSession, type Feed, type Row } from "./api";
import { currentFlavor } from "./flavor";

type FeedContextValue = {
  feed: Feed | null;
  notices: Row[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

const FeedContext = createContext<FeedContextValue | null>(null);

export function FeedProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [notices, setNotices] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
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
  return {
    name: brand?.name || feed?.site.name || flavor.displayName,
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
