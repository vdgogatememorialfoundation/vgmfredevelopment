"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { subscribeCms } from "@/lib/cms";
import { buildTickerItems, type TickerItem } from "@/lib/ticker";

function loopItems(items: TickerItem[]) {
  const block = [...items];
  while (block.length < 8) block.push(...items);
  return [...block, ...block];
}

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
  const row = loopItems(items);

  return (
    <div
      aria-label="Scrolling announcements"
      className="overflow-hidden border-b border-ink-soft bg-ink text-white"
    >
      <div className="animate-ticker flex w-max items-center gap-10 py-2.5">
        {row.map((item, index) => (
          <TickerLink key={`${item.id}-${index}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function TickerLink({ item }: { item: TickerItem }) {
  return (
    <Link
      href={item.href}
      className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-[14px] font-semibold leading-none text-white transition hover:text-white"
    >
      <span className="rounded-sm bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink">
        {item.category}
      </span>
      <span>{item.title}</span>
      <span aria-hidden="true" className="text-white">•</span>
    </Link>
  );
}
