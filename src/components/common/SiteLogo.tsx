"use client";

import { useState } from "react";
import { useSiteSettings } from "@/lib/use-cms";

export default function SiteLogo({ size = 48, className = "" }: { size?: number; className?: string }) {
  const settings = useSiteSettings();
  const name = settings?.siteName || "VGMF";
  const logoUrl = settings?.logoUrl || "";
  const [broken, setBroken] = useState(false);

  if (logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className={`h-10 w-auto max-w-[9rem] shrink-0 object-contain object-left sm:h-12 sm:max-w-[10.5rem] ${className}`}
        style={{ maxHeight: size }}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      style={{ height: Math.min(size, 40), width: Math.min(size, 40) }}
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-burgundy/30 bg-paper sm:h-12 sm:w-12 ${className}`}
    >
      <span className="px-1 text-center font-bold leading-none tracking-tight text-ink" style={{ fontSize: Math.max(9, size / 4.6) }}>
        {settings?.logoText || "VGMF"}
      </span>
    </div>
  );
}
