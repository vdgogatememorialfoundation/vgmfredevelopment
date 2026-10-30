"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/common/Badge";
import ApplicationPipeline from "@/components/applications/ApplicationPipeline";
import { resolveTrackedApplication, trackedFromTicket, type TrackedApplication } from "@/lib/application-pipeline";
import { partnerPortalHref, partnerPortalLabel } from "@/lib/partner-labels";
import { useAuth } from "@/components/auth/AuthContext";
import type { PartnerTicketSummary } from "@/types";

export default function ApplicationTracker({
  initialApplicationId,
}: {
  initialApplicationId?: string;
}) {
  const { user } = useAuth();
  const [applicationId, setApplicationId] = useState(initialApplicationId ?? "");
  const [tracked, setTracked] = useState<TrackedApplication | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialApplicationId) {
      void handleSearch(initialApplicationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(id: string) {
    const trimmed = id.trim();
    setApplicationId(trimmed);
    setSearched(true);
    setBusy(true);
    const local = resolveTrackedApplication(trimmed, user?.email);
    if (local) {
      setTracked(local);
      setNotFound(false);
      setBusy(false);
      return;
    }
    try {
      const response = await fetch(`/api/partners/track?id=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await response.json()) as { found?: boolean; ticket?: PartnerTicketSummary | null };
      if (data.found && data.ticket) {
        setTracked(trackedFromTicket(data.ticket, user?.email));
        setNotFound(false);
      } else {
        setTracked(null);
        setNotFound(true);
      }
    } catch {
      setTracked(null);
      setNotFound(true);
    } finally {
      setBusy(false);
    }
  }

  const application = tracked?.application;

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSearch(applicationId);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label htmlFor="application-id" className="sr-only">
          Application ID
        </label>
        <input
          id="application-id"
          type="text"
          value={applicationId}
          onChange={(e) => setApplicationId(e.target.value)}
          className="input-field flex-1 font-mono tracking-[0.06em]"
          placeholder="Seminar, Autism or Fellowship application ID"
        />
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Tracking…" : "Track Status"}
        </button>
      </form>

      {searched && notFound && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold">Application not found</p>
          <p className="mt-1">
            No Seminar, Autism or Fellowship application matches{" "}
            <span className="font-mono">{applicationId.trim()}</span>.
            Check the Application ID from your registration email and try again.
          </p>
        </div>
      )}

      {application && (
        <div className="mt-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-text-primary">{application.eventName}</p>
              <p className="mt-0.5 font-mono text-xs tracking-[0.08em] text-burgundy">
                {application.applicationId}
              </p>
              {tracked?.portalLabel ? (
                <p className="mt-1 text-xs text-text-muted">{tracked.portalLabel}</p>
              ) : null}
            </div>
            <Badge
              tone={
                application.status === "Approved" || application.status === "Confirmed"
                  ? "success"
                  : application.status === "Rejected"
                    ? "neutral"
                    : "warning"
              }
            >
              {application.status}
            </Badge>
          </div>

          <ApplicationPipeline application={application} />

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-xs text-text-muted">
              Questions about your application?{" "}
              <a href="/contact" className="font-semibold text-burgundy hover:underline">
                Contact the Foundation
              </a>
              {tracked?.ticket ? (
                <>
                  {" "}
                  or{" "}
                  <a
                    href={tracked.ticket.portalUrl || partnerPortalHref(tracked.ticket.portal)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-burgundy hover:underline"
                  >
                    open the {partnerPortalLabel(tracked.ticket.portal)}
                  </a>
                  .
                </>
              ) : null}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
