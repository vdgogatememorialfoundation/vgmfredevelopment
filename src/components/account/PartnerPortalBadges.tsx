"use client";

import type { PartnerPortal, PartnerPortalId, User } from "@/types";
import { usePartnerDrawer } from "@/components/account/PartnerPortalDrawer";

export function PartnerPortalBadges({
  user,
  portals,
  className = "",
  onOpen,
}: {
  user?: Pick<User, "partnerPortals"> | null;
  portals?: PartnerPortal[];
  className?: string;
  onOpen?: () => void;
}) {
  const items = portals ?? user?.partnerPortals ?? [];
  const drawer = usePartnerDrawer();
  if (!items.length) return null;

  function open(portal: PartnerPortalId | "all") {
    onOpen?.();
    if (drawer) drawer.open(portal);
    else if (portal !== "all") {
      const href = items.find((item) => item.id === portal)?.href;
      if (href) window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {items.map((portal) => (
        <button
          key={portal.id}
          type="button"
          onClick={() => open(portal.id)}
          className="rounded-full bg-burgundy/10 px-2 py-0.5 text-[11px] font-bold text-burgundy hover:bg-burgundy/15"
        >
          {portal.label}
        </button>
      ))}
      {drawer ? (
        <button
          type="button"
          onClick={() => open("all")}
          className="rounded-full border border-burgundy/20 px-2 py-0.5 text-[11px] font-semibold text-burgundy hover:bg-burgundy/5"
        >
          Open synced details
        </button>
      ) : null}
    </span>
  );
}
