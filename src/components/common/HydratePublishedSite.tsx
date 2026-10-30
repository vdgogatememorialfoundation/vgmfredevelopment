"use client";

import { useEffect } from "react";
import { hydratePublishedSite } from "@/lib/hydrate-public";

export function HydratePublishedSite() {
  useEffect(() => {
    void hydratePublishedSite();
  }, []);
  return null;
}
