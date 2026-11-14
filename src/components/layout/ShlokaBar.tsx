"use client";

import { useEffect, useState } from "react";
import { useSiteSettings } from "@/lib/use-cms";

export default function ShlokaBar() {
  const settings = useSiteSettings();
  const lines = (settings?.shlokas ?? []).map((line) => line.trim()).filter(Boolean);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (lines.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => current + 1), 8000);
    return () => window.clearInterval(timer);
  }, [lines.length]);

  if (!settings?.shlokaBar || !lines.length) return null;
  const line = lines[index % lines.length];

  return (
    <div className="border-b border-gold/30 bg-[#fffaf0]">
      <p
        key={line}
        lang="sa"
        className="container py-1.5 text-center font-serif text-[13px] leading-snug text-ink sm:text-sm"
      >
        {line}
      </p>
    </div>
  );
}
