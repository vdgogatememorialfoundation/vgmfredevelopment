"use client";

import { useEffect, useState } from "react";
import ApplicationPipeline from "@/components/applications/ApplicationPipeline";
import {
  resolveTrackedApplication,
  trackedFromTicket,
  type TrackedApplication,
} from "@/lib/application-pipeline";
import { partnerPortalLabel, partnerTrackHref } from "@/lib/partner-labels";
import { useAuth } from "@/components/auth/AuthContext";
import { usePartnerRecords } from "@/lib/use-partner-records";
import type { PartnerTicketSummary } from "@/types";

export default function ApplicationTracker({
  initialApplicationId,
}: {
  initialApplicationId?: string;
}) {
  const { user } = useAuth();
  const { tickets, loading } = usePartnerRecords(user?.email, user?.phone);
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
    }
    try {
      const response = await fetch(`/api/partners/track?id=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await response.json()) as {
        found?: boolean;
        ticket?: PartnerTicketSummary | null;
      };
      if (data.found && data.ticket) {
        setTracked(trackedFromTicket(data.ticket, user?.email));
        setNotFound(false);
      } else if (!local) {
        setTracked(null);
        setNotFound(true);
      }
    } catch {
      if (!local) {
        setTracked(null);
        setNotFound(true);
      }
    } finally {
      setBusy(false);
    }
  }

  const application = tracked?.application;
  const seminarHref = partnerTrackHref("seminar");

  return (
    <div className="vgmf-trk space-y-6">
      <div className="vgmf-trk-hero">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSearch(applicationId);
          }}
          className="flex w-full flex-col gap-3 sm:flex-row"
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
            {busy ? "Tracking…" : "Track"}
          </button>
        </form>
        {tickets.length ? (
          <div className="w-full">
            <p className="vgmf-trk-kicker">{loading ? "Updating live tracking…" : "Open one of your applications"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className="rounded-full border border-[#e6eeea] bg-white px-3 py-1 text-xs font-semibold text-[#0f1111]"
                  onClick={() => void handleSearch(ticket.applicationNo || ticket.id)}
                >
                  {ticket.eventName}
                  {ticket.applicationNo ? ` · ${ticket.applicationNo}` : ""}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {searched && notFound && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold">Application not found</p>
          <p className="mt-1">
            No Seminar, Autism or Fellowship application matches <span className="font-mono">{applicationId.trim()}</span>.
          </p>
        </div>
      )}

      {application && tracked ? (
        <div>
          <div className="vgmf-trk-hero">
            <div>
              <p className="vgmf-trk-kicker">{tracked.portalLabel || "Application"}</p>
              <h2>{application.eventName}</h2>
              <p className="vgmf-trk-kicker font-mono">{application.applicationId}</p>
            </div>
            {tracked.ticket ? (
              <a
                href={tracked.ticket.portal === "seminar" ? seminarHref : tracked.ticket.portalUrl || partnerTrackHref(tracked.ticket.portal)}
                target="_blank"
                rel="noopener noreferrer"
                className="trk-copy"
                style={{
                  border: "1px solid #d5d9d9",
                  background: "#fff",
                  color: "#0f1111",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontWeight: 700,
                  alignSelf: "flex-start",
                }}
              >
                {tracked.ticket.portal === "seminar"
                  ? "Open seminar.vaidyagogate.org/doctor"
                  : `Open ${partnerPortalLabel(tracked.ticket.portal)}`}
              </a>
            ) : null}
          </div>
          <ApplicationPipeline application={application} rawStatus={tracked.ticket?.status} />
        </div>
      ) : null}
    </div>
  );
}
