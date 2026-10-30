import { partnerPortalMeta } from "@/lib/constants";
import type { PartnerPortal, PartnerPortalId, User } from "@/types";

export const partnerPortalIds: PartnerPortalId[] = ["seminar", "autism", "fellowship"];

export function partnerPortalLabel(id: PartnerPortalId) {
  return partnerPortalMeta[id].label;
}

export function partnerPortalHref(id: PartnerPortalId) {
  return partnerPortalMeta[id].href;
}

export function partnerTicketHref(id: PartnerPortalId) {
  const meta = partnerPortalMeta[id];
  return `${meta.href}${meta.ticketsPath}`;
}

export function partnerCategory(id: PartnerPortalId) {
  if (id === "seminar") return "Seminar";
  if (id === "autism") return "Autism";
  return "Fellowship";
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
