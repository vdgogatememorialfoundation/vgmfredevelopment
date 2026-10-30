"use client";

import { useEffect, useState } from "react";
import { getPartnerPayments, getPartnerTickets, refreshPartnerAccount } from "@/lib/partner-hydrate";
import { fallbackApplicationStatuses, type PartnerStatusCatalog } from "@/lib/application-pipeline";
import type { PartnerPaymentSummary, PartnerTicketSummary } from "@/types";

const POLL_MS = 20_000;

export function usePartnerRecords(email?: string, phone?: string) {
  const [tickets, setTickets] = useState<PartnerTicketSummary[]>(() => (email ? getPartnerTickets(email) : []));
  const [payments, setPayments] = useState<PartnerPaymentSummary[]>(() => (email ? getPartnerPayments(email) : []));
  const [statuses, setStatuses] = useState<PartnerStatusCatalog>(fallbackApplicationStatuses);
  const [syncedAt, setSyncedAt] = useState("");
  const [loading, setLoading] = useState(Boolean(email));

  useEffect(() => {
    if (!email) {
      setTickets([]);
      setPayments([]);
      setLoading(false);
      return;
    }
    const read = () => {
      setTickets(getPartnerTickets(email));
      setPayments(getPartnerPayments(email));
    };
    read();
    let cancelled = false;

    const pullLive = async () => {
      try {
        const response = await fetch(`/api/partners/applications?email=${encodeURIComponent(email)}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("live");
        const data = (await response.json()) as {
          tickets?: PartnerTicketSummary[];
          payments?: PartnerPaymentSummary[];
          statuses?: PartnerStatusCatalog;
          syncedAt?: string;
        };
        if (cancelled) return;
        if (data.tickets) {
          const stored = JSON.parse(window.localStorage.getItem("vgmf_partner_tickets") || "{}") as Record<string, PartnerTicketSummary[]>;
          stored[email.toLowerCase()] = data.tickets;
          window.localStorage.setItem("vgmf_partner_tickets", JSON.stringify(stored));
          setTickets(data.tickets);
        }
        if (data.payments) {
          const stored = JSON.parse(window.localStorage.getItem("vgmf_partner_payments") || "{}") as Record<string, PartnerPaymentSummary[]>;
          stored[email.toLowerCase()] = data.payments;
          window.localStorage.setItem("vgmf_partner_payments", JSON.stringify(stored));
          setPayments(data.payments);
        }
        if (data.statuses) setStatuses(data.statuses);
        if (data.syncedAt) setSyncedAt(data.syncedAt);
        window.dispatchEvent(new Event("vgmf-cms"));
      } catch {
        await refreshPartnerAccount({ email, phone }).finally(() => {
          if (cancelled) return;
          read();
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    void pullLive();
    const timer = window.setInterval(() => void pullLive(), POLL_MS);
    const onChange = () => read();
    window.addEventListener("vgmf-cms", onChange);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("vgmf-cms", onChange);
    };
  }, [email, phone]);

  return { tickets, payments, statuses, syncedAt, loading };
}
