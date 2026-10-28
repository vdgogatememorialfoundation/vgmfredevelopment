"use client";

import { useSiteSettings } from "@/lib/use-cms";

export default function SiteLogo({ size = 48, className = "" }: { size?: number; className?: string }) {
  const settings = useSiteSettings();
  if (settings?.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={settings.logoUrl}
        alt={settings.siteName}
        style={{ height: size, maxWidth: size * 3 }}
        className={`w-auto shrink-0 object-contain ${className}`}
      />
    );
  }
  return (
    <div
      style={{ height: size, width: size }}
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-burgundy/25 bg-burgundy/5 ${className}`}
    >
      <span className="font-bold tracking-tight text-burgundy" style={{ fontSize: Math.max(9, size / 4.8) }}>
        {settings?.logoText || "VGMF"}
      </span>
    </div>
  );
}
