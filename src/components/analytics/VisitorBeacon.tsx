"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { heartbeat, recordVisit } from "@/lib/analytics";

export function VisitorBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    void recordVisit(pathname);
    const timer = window.setInterval(() => heartbeat(pathname), 20000);
    const onVisible = () => {
      if (document.visibilityState === "visible") heartbeat(pathname);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return null;
}
