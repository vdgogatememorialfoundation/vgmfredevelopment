"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth/AuthContext";
import ApplicationPipeline from "@/components/applications/ApplicationPipeline";
import Badge from "@/components/common/Badge";
import { applicationFromTicket, kindLabel, normalizeApplicationStatus } from "@/lib/application-pipeline";
import { partnerPortalHref, partnerPortalLabel, partnerTrackHref } from "@/lib/partner-labels";
import { usePartnerRecords } from "@/lib/use-partner-records";
import type { PartnerPortalId } from "@/types";

type DrawerPortal = PartnerPortalId | "all";

type PartnerDrawerContextValue = {
  open: (portal?: DrawerPortal) => void;
  close: () => void;
};

const PartnerDrawerContext = createContext<PartnerDrawerContextValue | null>(null);

export function usePartnerDrawer() {
  return useContext(PartnerDrawerContext);
}

export function PartnerDrawerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [portal, setPortal] = useState<DrawerPortal>("all");
  const [visible, setVisible] = useState(false);
  const { tickets, payments, loading } = usePartnerRecords(user?.email, user?.phone);

  const open = useCallback((next: DrawerPortal = "all") => {
    setPortal(next);
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, close]);

  const value = useMemo(() => ({ open, close }), [open, close]);
  const filteredTickets = portal === "all" ? tickets : tickets.filter((item) => item.portal === portal);
  const filteredPayments = portal === "all" ? payments : payments.filter((item) => item.portal === portal);
  const title = portal === "all" ? "Linked programmes" : partnerPortalLabel(portal);

  return (
    <PartnerDrawerContext.Provider value={value}>
      {children}
      {visible && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={title}>
              <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close linked programmes" onClick={close} />
              <aside className="absolute inset-y-0 right-0 flex w-[min(28rem,94vw)] flex-col bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-burgundy">Synced from sister portals</p>
                    <h2 className="mt-1 font-serif text-xl text-ink">{title}</h2>
                    {user?.email ? <p className="mt-1 text-xs text-text-muted">{user.email}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border"
                    aria-label="Close"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto border-b border-border px-5 py-3">
                  {(["all", "seminar", "autism", "fellowship"] as DrawerPortal[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPortal(item)}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        portal === item ? "bg-burgundy text-white" : "bg-warm-cream text-text-primary"
                      }`}
                    >
                      {item === "all" ? "All" : partnerPortalLabel(item).replace(" Portal", "")}
                    </button>
                  ))}
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
                  {loading ? <p className="text-sm text-text-muted">Loading synced registrations and payments…</p> : null}

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Registrations and applications</h3>
                    {filteredTickets.length ? (
                      <ul className="mt-3 space-y-3">
                        {filteredTickets.map((ticket) => {
                          const application = applicationFromTicket(ticket, user?.email);
                          return (
                            <li key={ticket.id} className="rounded-2xl border border-border p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-text-primary">{ticket.eventName}</p>
                                  <p className="mt-1 text-xs text-text-muted">
                                    {partnerPortalLabel(ticket.portal)} · {kindLabel(ticket.kind)}
                                    {ticket.applicationNo ? ` · ${ticket.applicationNo}` : ""}
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
                                <ApplicationPipeline application={application} />
                              </div>
                              <div className="mt-3 flex flex-wrap gap-3">
                                <Link
                                  href={`/application-status?applicationId=${encodeURIComponent(ticket.applicationNo || ticket.id)}`}
                                  onClick={close}
                                  className="text-xs font-semibold text-burgundy hover:underline"
                                >
                                  Track on this portal
                                </Link>
                                <a
                                  href={ticket.portal === "seminar" ? partnerTrackHref("seminar") : ticket.portalUrl || partnerPortalHref(ticket.portal)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-semibold text-burgundy hover:underline"
                                >
                                  {ticket.portal === "seminar" ? "Track on Seminar doctor portal" : "Open sister portal"}
                                </a>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-text-muted">No registrations or applications are linked for this view yet.</p>
                    )}
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Payments</h3>
                    {filteredPayments.length ? (
                      <ul className="mt-3 space-y-3">
                        {filteredPayments.map((payment) => (
                          <li key={payment.id} className="rounded-2xl border border-border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-mono text-sm font-semibold text-text-primary">{payment.id}</p>
                                <p className="mt-1 text-xs text-text-muted">
                                  {payment.eventName || partnerPortalLabel(payment.portal)}
                                  {payment.at ? ` · ${new Date(payment.at).toLocaleDateString("en-IN")}` : ""}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge tone="success">{payment.status}</Badge>
                                <p className="mt-2 font-bold text-burgundy">₹{payment.amount.toLocaleString("en-IN")}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-text-muted">No payments from the sister portals are linked here yet.</p>
                    )}
                  </section>
                </div>
              </aside>
            </div>,
            document.body
          )
        : null}
    </PartnerDrawerContext.Provider>
  );
}
