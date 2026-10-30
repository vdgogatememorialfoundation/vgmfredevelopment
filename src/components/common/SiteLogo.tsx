"use client";

import { useState } from "react";
import { useSiteSettings } from "@/lib/use-cms";

export default function SiteLogo({ size = 48, className = "" }: { size?: number; className?: string }) {
  const settings = useSiteSettings();
  const name = settings?.siteName || "VGMF";
  const logoUrl = settings?.logoUrl || "";
  const [broken, setBroken] = useState(false);
  const height = Math.min(Math.max(size, 36), 56);

  if (logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className={`block shrink-0 object-contain object-left ${className}`}
        style={{ height, width: "auto", maxHeight: height, maxWidth: Math.max(height * 3.2, 120) }}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      style={{ height, width: height }}
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-burgundy/30 bg-paper ${className}`}
    >
      <span className="px-1 text-center font-bold leading-none tracking-tight text-ink" style={{ fontSize: Math.max(9, height / 4.6) }}>
        {settings?.logoText || "VGMF"}
      </span>
    </div>
  );
}
