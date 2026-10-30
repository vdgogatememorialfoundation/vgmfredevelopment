"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/common/Badge";
import ApplicationPipeline from "@/components/applications/ApplicationPipeline";
import {
  fallbackApplicationStatuses,
  kindLabel,
  mergeStatusCatalog,
  normalizeApplicationStatus,
  resolveTrackedApplication,
  trackedFromTicket,
  type PartnerStatusCatalog,
  type TrackedApplication,
} from "@/lib/application-pipeline";
import { partnerPortalLabel, partnerTrackHref } from "@/lib/partner-labels";
import { useAuth } from "@/components/auth/AuthContext";
import { usePartnerRecords } from "@/lib/use-partner-records";
import type { PartnerPortalId, PartnerTicketSummary } from "@/types";

export default function ApplicationTracker({
  initialApplicationId,
}: {
  initialApplicationId?: string;
}) {
  const { user } = useAuth();
  const { tickets, statuses, syncedAt, loading } = usePartnerRecords(user?.email, user?.phone);
  const [applicationId, setApplicationId] = useState(initialApplicationId ?? "");
  const [tracked, setTracked] = useState<TrackedApplication | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [liveCatalog, setLiveCatalog] = useState<PartnerStatusCatalog>(statuses);

  useEffect(() => {
    setLiveCatalog(mergeStatusCatalog(statuses));
  }, [statuses]);

  useEffect(() => {
    if (user?.email) return;
    let cancelled = false;
    void fetch("/api/partners/applications", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((data: { statuses?: PartnerStatusCatalog }) => {
        if (!cancelled && data.statuses) setLiveCatalog(mergeStatusCatalog(data.statuses));
      })
      .catch(() => {
        /* keep fallbacks */
      });
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

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
        statuses?: PartnerStatusCatalog;
      };
      if (data.statuses) setLiveCatalog(mergeStatusCatalog(data.statuses));
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
  const grouped = useMemo(() => {
    const buckets: Record<PartnerPortalId, PartnerTicketSummary[]> = { seminar: [], autism: [], fellowship: [] };
    for (const ticket of tickets) buckets[ticket.portal].push(ticket);
    return buckets;
  }, [tickets]);

  return (
    <div className="space-y-6">
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
              No Seminar, Autism or Fellowship application matches <span className="font-mono">{applicationId.trim()}</span>.
              Check the Application ID from your registration email and try again.
            </p>
          </div>
        )}

        {application && (
          <div className="mt-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-text-primary">{application.eventName}</p>
                <p className="mt-0.5 font-mono text-xs tracking-[0.08em] text-burgundy">{application.applicationId}</p>
                {tracked?.portalLabel ? <p className="mt-1 text-xs text-text-muted">{tracked.portalLabel}</p> : null}
                {tracked?.ticket?.status ? (
                  <p className="mt-1 text-xs text-text-muted">Live status: {tracked.ticket.status}</p>
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
                {tracked?.ticket?.status || application.status}
              </Badge>
            </div>

            <ApplicationPipeline application={application} rawStatus={tracked?.ticket?.status} />

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
                      href={tracked.ticket.portal === "seminar" ? partnerTrackHref("seminar") : tracked.ticket.portalUrl || partnerTrackHref(tracked.ticket.portal)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-burgundy hover:underline"
                    >
                      {tracked.ticket.portal === "seminar" ? "open the Seminar doctor portal" : `open the ${partnerPortalLabel(tracked.ticket.portal)}`}
                    </a>
                    .
                  </>
                ) : null}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-burgundy">Live application list</p>
            <h2 className="mt-1 font-serif text-xl text-ink">Seminar, Autism and Fellowship</h2>
            <p className="mt-1 text-xs text-text-muted">
              Statuses are read from the three sister sites{syncedAt ? ` · refreshed ${new Date(syncedAt).toLocaleTimeString("en-IN")}` : ""}.
              {loading ? " Updating…" : ""}
            </p>
          </div>
        </div>

        <StatusCatalog catalog={liveCatalog} />

        {(["seminar", "autism", "fellowship"] as PartnerPortalId[]).map((portal) => (
          <section key={portal} className="mt-6 border-t border-border pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text-primary">{partnerPortalLabel(portal)}</h3>
              <a
                href={partnerTrackHref(portal)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-burgundy hover:underline"
              >
                {portal === "seminar" ? "Track on seminar.vaidyagogate.org/doctor" : `Open ${partnerPortalLabel(portal)}`}
              </a>
            </div>
            {grouped[portal].length ? (
              <ul className="space-y-3">
                {grouped[portal].map((ticket) => (
                  <li key={ticket.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-text-primary">{ticket.eventName}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          {kindLabel(ticket.kind)}
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
                    <div className="mt-4">
                      <ApplicationPipeline application={trackedFromTicket(ticket, user?.email).application} rawStatus={ticket.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="text-xs font-semibold text-burgundy hover:underline"
                        onClick={() => void handleSearch(ticket.applicationNo || ticket.id)}
                      >
                        Open tracker
                      </button>
                      <a
                        href={portal === "seminar" ? partnerTrackHref("seminar") : ticket.portalUrl || partnerTrackHref(portal)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-burgundy hover:underline"
                      >
                        {portal === "seminar" ? "Track on Seminar doctor portal" : `Open ${partnerPortalLabel(portal)}`}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">
                {user?.email
                  ? `No live ${partnerPortalLabel(portal).replace(" Portal", "")} applications for this account yet.`
                  : "Sign in to load your live applications from the sister sites."}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function StatusCatalog({ catalog }: { catalog: PartnerStatusCatalog }) {
  const merged = mergeStatusCatalog(catalog);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {(Object.keys(merged) as PartnerPortalId[]).map((portal) => (
        <div key={portal} className="rounded-xl bg-warm-cream/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{partnerPortalLabel(portal)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(merged[portal].length ? merged[portal] : fallbackApplicationStatuses[portal]).map((status) => (
              <span key={status} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-text-primary">
                {status}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
