"use client";

import { useSyncExternalStore, type ReactNode } from "react";

export default function ClientOnly({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  if (!ready) return null;
  return children;
}
