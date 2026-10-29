"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { subscribeCms } from "@/lib/cms";
import { buildTickerItems, type TickerItem } from "@/lib/ticker";

export default function AnnouncementTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);

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
  const row = items.length === 1 ? [...items, ...items] : [...items, ...items];

  return (
    <div
      aria-label="Scrolling announcements"
      className="overflow-hidden border-b border-ink-soft bg-ink text-stone-100"
    >
      <div className="flex w-max items-center gap-10 py-2.5 pl-10 animate-marquee">
        {row.map((item, index) => (
          <Link
            key={`${item.id}-${index}`}
            href={item.href}
            className="flex shrink-0 items-center gap-2.5 text-xs font-medium text-slate-100 transition hover:text-white"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-white">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
              {item.category}
            </span>
            <span className="max-w-[28rem] truncate">{item.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
