"use client";

import Script from "next/script";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  ARTICLE_ADSENSE_CLIENT,
  ARTICLE_ADSENSE_SCRIPT,
  articleAdSlot,
  articleAdsDisabled,
  articleAdsLive,
  type ArticleAdPlacement,
} from "@/lib/article-ads";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const noop = () => () => {};

function useHostname() {
  return useSyncExternalStore(noop, () => window.location.hostname, () => "");
}

export function ArticleAdScript() {
  const host = useHostname();
  if (articleAdsDisabled() || !articleAdsLive(host)) return null;
  return <Script id="adsense-articles" src={ARTICLE_ADSENSE_SCRIPT} strategy="afterInteractive" crossOrigin="anonymous" />;
}

export function ArticleAd({ placement, className = "" }: { placement: ArticleAdPlacement; className?: string }) {
  const host = useHostname();
  const slot = articleAdSlot(placement);
  const live = articleAdsLive(host);
  const pushed = useRef(false);

  useEffect(() => {
    if (!live || !slot || pushed.current || articleAdsDisabled()) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* this unit was already filled */
    }
  }, [live, slot]);

  if (!host || articleAdsDisabled()) return null;
  if (!live) {
    return (
      <div
        className={`flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-border bg-warm-cream/60 text-xs font-semibold uppercase tracking-wide text-text-muted ${className}`}
        aria-hidden="true"
      >
        Advertisement · shown on vaidyagogate.org
      </div>
    );
  }
  if (!slot) return null;
  return (
    <div className={className}>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-text-muted">Advertisement</p>
      <ins
        className="adsbygoogle block"
        style={{ display: "block", textAlign: "center" }}
        data-ad-client={ARTICLE_ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={placement === "inline" ? "fluid" : "auto"}
        {...(placement === "inline" ? { "data-ad-layout": "in-article" } : { "data-full-width-responsive": "true" })}
      />
    </div>
  );
}
