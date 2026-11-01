"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { subscribeCms } from "@/lib/cms";
import { buildTickerItems, type TickerItem } from "@/lib/ticker";

export default function AnnouncementTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const refresh = () => setItems(buildTickerItems());
    refresh();
    const unsubscribe = subscribeCms(refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  if (items.length === 0) return null;
  const row = items.length === 1 ? [...items, ...items, ...items] : [...items, ...items];

  return (
    <div
      aria-label="Scrolling announcements"
      className="relative isolate overflow-hidden border-b border-burgundy/25 bg-burgundy text-[#f7f1e8]"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-burgundy via-burgundy to-transparent sm:w-44" />
      <div className="pointer-events-none absolute inset-y-0 right-12 z-10 w-10 bg-gradient-to-l from-burgundy to-transparent" />
      <p className="absolute left-3 top-1/2 z-20 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-[0.22em] text-gold sm:left-5">
        Live
      </p>
      <div
        className={`flex w-max items-center gap-8 py-2.5 pl-24 sm:gap-12 sm:pl-36 ${paused ? "" : "animate-ticker"}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {row.map((item, index) => (
          <TickerLink key={`${item.id}-${index}`} item={item} />
        ))}
      </div>
      <button
        type="button"
        aria-pressed={paused}
        aria-label={paused ? "Play announcements" : "Pause announcements"}
        onClick={() => setPaused((value) => !value)}
        className="absolute right-2 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-burgundy-dark/40 text-[#f7f1e8] transition hover:bg-white/10"
      >
        {paused ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
        )}
      </button>
    </div>
  );
}

function TickerLink({ item }: { item: TickerItem }) {
  return (
    <Link href={item.href} className="flex shrink-0 items-center gap-2.5 text-[13px] font-medium text-[#f7f1e8]/90 transition hover:text-gold">
      <span className="rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
        {item.category}
      </span>
      <span className="max-w-[34rem] truncate">{item.title}</span>
      <span aria-hidden="true" className="text-gold/70">◆</span>
    </Link>
  );
}
