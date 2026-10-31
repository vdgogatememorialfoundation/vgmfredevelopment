import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

const KEY = "vgmf-wishlist";

type WishlistValue = {
  ids: string[];
  ready: boolean;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
};

const WishlistContext = createContext<WishlistValue | null>(null);

async function readIds() {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.map((id) => String(id)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void readIds().then((next) => {
      setIds(next);
      setReady(true);
    });
  }, []);

  const persist = useCallback((next: string[]) => {
    setIds(next);
    void SecureStore.setItemAsync(KEY, JSON.stringify(next));
  }, []);

  const value = useMemo<WishlistValue>(
    () => ({
      ids,
      ready,
      has: (id) => ids.includes(id),
      toggle: (id) => persist(ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]),
    }),
    [ids, persist, ready]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("WishlistProvider missing");
  return value;
}
