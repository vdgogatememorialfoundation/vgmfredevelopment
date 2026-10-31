"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveBanners } from "@/lib/use-cms";

const DISMISS_KEY = "vgmf_banner_dismissed";

function dismissedIds() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = window.sessionStorage.getItem(DISMISS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function isImage(value?: string) {
  return Boolean(value && /^(https?:|data:image|\/)/i.test(value));
}

export default function BannerPopup() {
  const banners = useLiveBanners();
  const [hidden, setHidden] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setHidden(dismissedIds());
    setReady(true);
  }, []);

  const banner = useMemo(
    () => banners.find((item) => isImage(item.image) && !hidden.includes(item.id)),
    [banners, hidden]
  );

  if (!ready || !banner) return null;

  const dismiss = () => {
    const next = [...hidden, banner.id];
    setHidden(next);
    window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  };

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={banner.image} alt={banner.title || "Site banner"} className="max-h-[70vh] w-full object-contain" />
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-ink/60" aria-label="Close banner" onClick={dismiss} />
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg text-ink shadow"
          aria-label="Dismiss banner"
        >
          ×
        </button>
        {banner.href ? (
          <a href={banner.href} onClick={dismiss} className="block">
            {image}
          </a>
        ) : (
          image
        )}
        {banner.title ? (
          <p className="border-t border-border px-4 py-3 text-center text-sm font-medium text-text-primary">{banner.title}</p>
        ) : null}
      </div>
    </div>
  );
}
