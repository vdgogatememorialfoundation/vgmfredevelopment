"use client";

import Link from "next/link";
import { useMemo } from "react";
import SectionHeader from "@/components/account/SectionHeader";
import { useAuth } from "@/components/auth/AuthContext";
import { PartnerPortalBadges } from "@/components/account/PartnerPortalBadges";
import { autismSiteUrl, seminarSiteUrl } from "@/lib/constants";
import { getPartnerTickets } from "@/lib/partner-hydrate";

export default function ApplicationsPage() {
  const { user } = useAuth();
  const tickets = useMemo(() => (user?.email ? getPartnerTickets(user.email) : []), [user]);

  return (
    <div>
      <SectionHeader
        title="View Application Status"
        description="Applications for Foundation events are processed on the Seminar and Autism portals. Status is copied here; QR codes stay on those sites."
      />
      <PartnerPortalBadges user={user} className="mb-5" />
      {tickets.length ? (
        <ul className="space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="rounded-2xl border border-border bg-white p-5">
              <p className="font-semibold text-text-primary">{ticket.eventName}</p>
              <p className="mt-1 text-sm text-text-muted">
                {ticket.portal === "seminar" ? "Seminar Portal" : "Autism Portal"} · {ticket.status}
              </p>
              <a
                href={ticket.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline mt-4 inline-flex"
              >
                Open on {ticket.portal === "seminar" ? "Seminar" : "Autism"} Portal
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-burgundy/20 bg-burgundy/5 p-8 text-center">
          <p className="text-sm text-text-muted">
            Track your application on the official Seminar or Autism website.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={seminarSiteUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Track on Seminar Website
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
