"use client";

import { useEffect, useRef } from "react";
import { collectMobileSnapshot, publishLiveSite } from "@/lib/mobile-publish";

const SETTLE_MS = 1800;
const HYDRATE_GUARD_MS = 4000;

function snapshotLooksPublishable() {
  const snapshot = collectMobileSnapshot();
  const events = snapshot.events?.length ?? 0;
  const articles = snapshot.articles?.length ?? 0;
  const books = snapshot.books?.length ?? 0;
  const gallery = snapshot.gallery?.length ?? 0;
  const notices = snapshot.notices?.length ?? 0;
  const about = snapshot.about ? 1 : 0;
  return events + articles + books + gallery + notices + about > 0;
}

/** Push the admin CMS to the public app feed after each save. Public visitors never mount this. */
export function LivePublishBridge() {
  const touched = useRef(false);
  const ready = useRef(false);
  const busy = useRef(false);
  const timer = useRef<number>(0);

  useEffect(() => {
    const markTouched = () => {
      touched.current = true;
    };
    window.addEventListener("pointerdown", markTouched);
    window.addEventListener("keydown", markTouched);
    const unlock = window.setTimeout(() => {
      ready.current = true;
    }, HYDRATE_GUARD_MS);

    const flush = () => {
      if (!ready.current || !touched.current || busy.current) return;
      if (!snapshotLooksPublishable()) return;
      busy.current = true;
      void publishLiveSite().finally(() => {
        busy.current = false;
      });
    };

    const onCms = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SETTLE_MS);
    };

    window.addEventListener("vgmf-cms", onCms);
    return () => {
      window.clearTimeout(unlock);
      window.clearTimeout(timer.current);
      window.removeEventListener("pointerdown", markTouched);
      window.removeEventListener("keydown", markTouched);
      window.removeEventListener("vgmf-cms", onCms);
    };
  }, []);

  return null;
}
