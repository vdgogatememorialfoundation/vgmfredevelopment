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
      className="relative isolate overflow-hidden border-b border-burgundy-dark bg-burgundy text-white"
    >
      <div className="flex min-h-11 items-stretch">
        <p className="flex shrink-0 items-center bg-gold px-3 text-[12px] font-bold uppercase tracking-[0.16em] text-burgundy sm:px-4 sm:text-[13px]">
          Live
        </p>
        <div className="relative min-w-0 flex-1">
          <div
            className={`flex w-max items-center gap-10 py-2.5 pl-5 pr-8 ${paused ? "" : "animate-ticker"}`}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {row.map((item, index) => (
              <TickerLink key={`${item.id}-${index}`} item={item} />
            ))}
          </div>
        </div>
        <button
          type="button"
          aria-pressed={paused}
          aria-label={paused ? "Play announcements" : "Pause announcements"}
          onClick={() => setPaused((value) => !value)}
          className="flex w-11 shrink-0 items-center justify-center border-l border-white bg-burgundy-dark text-white transition hover:bg-ink"
        >
          {paused ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}

function TickerLink({ item }: { item: TickerItem }) {
  return (
    <Link href={item.href} className="flex shrink-0 items-center gap-3 text-[15px] font-semibold leading-none text-white transition hover:text-gold">
      <span className="rounded-sm bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-burgundy">
        {item.category}
      </span>
      <span>{item.title}</span>
      <span aria-hidden="true" className="text-gold">●</span>
    </Link>
  );
}
