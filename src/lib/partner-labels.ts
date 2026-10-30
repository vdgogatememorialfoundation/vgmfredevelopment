import { autismSiteUrl, partnerPortalMeta, seminarSiteUrl } from "@/lib/constants";
import type { PartnerPortal, PartnerPortalId, User } from "@/types";

export function partnerPortalLabel(id: PartnerPortalId) {
  return partnerPortalMeta[id].label;
}

export function partnerPortalHref(id: PartnerPortalId) {
  return id === "seminar" ? seminarSiteUrl : autismSiteUrl;
}

export function partnerTicketHref(id: PartnerPortalId) {
  const meta = partnerPortalMeta[id];
  return `${meta.href}${meta.ticketsPath}`;
}

export function portalBadge(id: PartnerPortalId, extra?: Partial<PartnerPortal>): PartnerPortal {
  return {
    id,
    label: partnerPortalLabel(id),
    href: partnerPortalHref(id),
    ...extra,
  };
}

export function hasPartnerPortal(user: Pick<User, "partnerPortals"> | null | undefined, id?: PartnerPortalId) {
  const portals = user?.partnerPortals ?? [];
  if (!id) return portals.length > 0;
  return portals.some((portal) => portal.id === id);
}
