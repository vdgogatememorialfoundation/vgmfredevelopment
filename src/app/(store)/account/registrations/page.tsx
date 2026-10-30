"use client";

import Link from "next/link";
import Badge from "@/components/common/Badge";
import SectionHeader from "@/components/account/SectionHeader";
import { useAuth } from "@/components/auth/AuthContext";
import { PartnerPortalBadges } from "@/components/account/PartnerPortalBadges";
import ApplicationPipeline from "@/components/applications/ApplicationPipeline";
import { autismSiteUrl, fellowshipSiteUrl, seminarSiteUrl } from "@/lib/constants";
import { applicationFromTicket, kindLabel, normalizeApplicationStatus } from "@/lib/application-pipeline";
import { partnerPortalHref, partnerPortalLabel } from "@/lib/partner-labels";
import { usePartnerRecords } from "@/lib/use-partner-records";

export default function RegistrationsPage() {
  const { user } = useAuth();
  const { tickets, loading } = usePartnerRecords(user?.email, user?.phone);

  return (
    <div>
      <SectionHeader
        title="My Event Registrations"
        description="Seminar, Autism and Fellowship registrations are listed here with the same application tracker used on this portal."
      />
      <PartnerPortalBadges user={user} className="mb-5" />
      {loading ? <p className="mb-4 text-sm text-text-muted">Loading synced registrations…</p> : null}
      {tickets.length ? (
        <ul className="space-y-3">
          {tickets.map((ticket) => {
            const application = applicationFromTicket(ticket, user?.email);
            return (
              <li key={ticket.id} className="rounded-2xl border border-border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text-primary">{ticket.eventName}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {partnerPortalLabel(ticket.portal)} · {kindLabel(ticket.kind)}
                      {ticket.applicationNo ? ` · ${ticket.applicationNo}` : ""}
                      {ticket.issuedAt ? ` · ${new Date(ticket.issuedAt).toLocaleDateString("en-IN")}` : ""}
                    </p>
                  </div>
                  <Badge
                    tone={
                      normalizeApplicationStatus(ticket.status) === "Confirmed" ||
                      normalizeApplicationStatus(ticket.status) === "Approved"
                        ? "success"
                        : normalizeApplicationStatus(ticket.status) === "Rejected"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {ticket.status}
                  </Badge>
                </div>
                <div className="mt-5">
                  <ApplicationPipeline application={application} />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/application-status?applicationId=${encodeURIComponent(ticket.applicationNo || ticket.id)}`}
                    className="btn-primary"
                  >
                    Track application
                  </Link>
                  <a
                    href={ticket.portalUrl || partnerPortalHref(ticket.portal)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline"
                  >
                    Open e-ticket
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !loading && (
          <div className="rounded-2xl border border-burgundy/20 bg-burgundy/5 p-8 text-center">
            <p className="text-sm text-text-muted">
              No sister-portal registrations are linked to this account yet. Register on the Seminar, Autism or Fellowship site and it will appear here.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href={seminarSiteUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                Seminar Portal
              </Link>
              <Link href={autismSiteUrl} target="_blank" rel="noopener noreferrer" className="btn-outline">
                Autism Portal
              </Link>
              <Link href={fellowshipSiteUrl} target="_blank" rel="noopener noreferrer" className="btn-outline">
                Fellowship Portal
              </Link>
            </div>
          </div>
        )
      )}
    </div>
  );
}
