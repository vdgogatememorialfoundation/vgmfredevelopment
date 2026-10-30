"use client";

import { useMemo } from "react";
import Badge from "@/components/common/Badge";
import SectionHeader from "@/components/account/SectionHeader";
import { useAuth } from "@/components/auth/AuthContext";
import { PartnerPortalBadges } from "@/components/account/PartnerPortalBadges";
import { getPartnerPayments } from "@/lib/partner-hydrate";
import { partnerPortalLabel } from "@/lib/partner-labels";

const demoPayments = [
  {
    id: "VGMF-PAY-3351",
    date: "2026-09-02",
    for: "Shop order VGMF-ORD-2026-1201",
    amount: 690,
    status: "Paid",
    method: "Razorpay · Card",
  },
  {
    id: "VGMF-PAY-2914",
    date: "2026-08-30",
    for: "Shop order VGMF-ORD-2026-1042",
    amount: 850,
    status: "Paid",
    method: "Razorpay · UPI",
  },
];

export default function PaymentsPage() {
  const { user } = useAuth();
  const partnerPayments = useMemo(() => (user?.email ? getPartnerPayments(user.email) : []), [user]);

  return (
    <div>
      <SectionHeader
        title="My Payments"
        description="Your payment history across event registrations and shop orders."
      />
      <PartnerPortalBadges user={user} className="mb-5" />

      <div className="space-y-4">
        {partnerPayments.map((payment) => (
          <article key={payment.id} className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold text-text-primary">{payment.id}</p>
                <p className="mt-0.5 text-sm text-text-muted">
                  {payment.eventName || partnerPortalLabel(payment.portal)}
                  {payment.at ? ` · ${new Date(payment.at).toLocaleDateString("en-IN")}` : ""}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {partnerPortalLabel(payment.portal)} · Receipt on that portal
                </p>
              </div>
              <div className="text-right">
                <Badge tone={payment.status.toLowerCase().includes("paid") || payment.status.toLowerCase() === "captured" ? "success" : "neutral"}>
                  {payment.status}
                </Badge>
                <p className="mt-2 font-bold text-burgundy">
                  ₹{payment.amount.toLocaleString("en-IN")}
                </p>
                <a href={payment.portalUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-burgundy">
                  Open portal
                </a>
              </div>
            </div>
          </article>
        ))}
        {demoPayments.map((payment) => (
          <article key={payment.id} className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold text-text-primary">
                  {payment.id}
                </p>
                <p className="mt-0.5 text-sm text-text-muted">
                  {payment.for} · {payment.date}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {payment.method}
                </p>
              </div>
              <div className="text-right">
                <Badge tone="success">{payment.status}</Badge>
                <p className="mt-2 font-bold text-burgundy">
                  ₹{payment.amount.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}