"use client";

import { useEffect, useState } from "react";
import { getPartnerPayments, getPartnerTickets, refreshPartnerAccount } from "@/lib/partner-hydrate";
import type { PartnerPaymentSummary, PartnerTicketSummary } from "@/types";

export function usePartnerRecords(email?: string, phone?: string) {
  const [tickets, setTickets] = useState<PartnerTicketSummary[]>(() => (email ? getPartnerTickets(email) : []));
  const [payments, setPayments] = useState<PartnerPaymentSummary[]>(() => (email ? getPartnerPayments(email) : []));
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
    setLoading(true);
    void refreshPartnerAccount({ email, phone }).finally(() => {
      if (cancelled) return;
      read();
      setLoading(false);
    });
    const onChange = () => read();
    window.addEventListener("vgmf-cms", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("vgmf-cms", onChange);
    };
  }, [email, phone]);

  return { tickets, payments, loading };
}
