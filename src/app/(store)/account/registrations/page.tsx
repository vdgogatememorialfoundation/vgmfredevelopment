"use client";

import Link from "next/link";
import { useMemo } from "react";
import SectionHeader from "@/components/account/SectionHeader";
import { useAuth } from "@/components/auth/AuthContext";
import { PartnerPortalBadges } from "@/components/account/PartnerPortalBadges";
import { autismSiteUrl, seminarSiteUrl } from "@/lib/constants";
import { getPartnerTickets } from "@/lib/partner-hydrate";
import { partnerPortalHref } from "@/lib/partner-labels";

export default function RegistrationsPage() {
  const { user } = useAuth();
  const tickets = useMemo(() => (user?.email ? getPartnerTickets(user.email) : []), [user]);

  return (
    <div>
      <SectionHeader
        title="My Event Registrations"
        description="Seminar and Autism registrations are listed here. Open the matching portal to view the e-ticket QR."
      />
      <PartnerPortalBadges user={user} className="mb-5" />
      {tickets.length ? (
        <ul className="space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-text-primary">{ticket.eventName}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {ticket.portal === "seminar" ? "Seminar Portal" : "Autism Portal"} · {ticket.status}
                    {ticket.issuedAt ? ` · ${new Date(ticket.issuedAt).toLocaleDateString("en-IN")}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-text-muted">
                    The QR code for this e-ticket is only shown on the {ticket.portal === "seminar" ? "Seminar" : "Autism"} portal.
                  </p>
                </div>
                <a
                  href={ticket.portalUrl || partnerPortalHref(ticket.portal)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  Open e-ticket
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-burgundy/20 bg-burgundy/5 p-8 text-center">
          <p className="text-sm text-text-muted">
            No sister-portal registrations are linked to this account yet. Register on the Seminar or Autism site and it will appear here.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={seminarSiteUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Seminar Portal
            </Link>
            <Link href={autismSiteUrl} target="_blank" rel="noopener noreferrer" className="btn-outline">
              Autism Portal
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
