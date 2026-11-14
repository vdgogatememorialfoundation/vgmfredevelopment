"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
    () =>
      banners.find((item) => isImage(item.image) && !hidden.includes(item.id)),
    [banners, hidden],
  );

  if (!ready || !banner || typeof document === "undefined") return null;

  const dismiss = () => {
    const next = [...hidden, banner.id];
    setHidden(next);
    window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  };

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.image}
      alt={banner.title || "Site banner"}
      className="block h-auto max-h-[78dvh] w-full !max-w-none object-contain"
    />
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={banner.title || "Site banner"}
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/70"
        aria-label="Close banner"
        onClick={dismiss}
      />
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-white text-xl text-ink shadow-lg"
          aria-label="Dismiss banner"
        >
          ×
        </button>
        <div className="w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
          {banner.href ? (
            <a
              href={banner.href}
              onClick={dismiss}
              className="block min-h-[180px] bg-paper"
            >
              {image}
            </a>
          ) : (
            <div className="min-h-[180px] bg-paper">{image}</div>
          )}
          {banner.title ? (
            <p className="border-t border-border px-4 py-3 text-center text-sm font-medium text-text-primary">
              {banner.title}
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
