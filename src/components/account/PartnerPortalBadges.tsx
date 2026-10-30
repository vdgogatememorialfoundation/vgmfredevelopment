import type { PartnerPortal, User } from "@/types";

export function PartnerPortalBadges({
  user,
  portals,
  className = "",
}: {
  user?: Pick<User, "partnerPortals"> | null;
  portals?: PartnerPortal[];
  className?: string;
}) {
  const items = portals ?? user?.partnerPortals ?? [];
  if (!items.length) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {items.map((portal) => (
        <a
          key={portal.id}
          href={portal.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-burgundy/10 px-2 py-0.5 text-[11px] font-bold text-burgundy hover:bg-burgundy/15"
        >
          {portal.label}
        </a>
      ))}
    </span>
  );
}
