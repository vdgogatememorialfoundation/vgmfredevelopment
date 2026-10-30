"use client";

import Badge from "@/components/common/Badge";
import EmptyState from "@/components/account/EmptyState";
import SectionHeader from "@/components/account/SectionHeader";
import { useAuth } from "@/components/auth/AuthContext";
import { PartnerPortalBadges } from "@/components/account/PartnerPortalBadges";
import { partnerPortalLabel } from "@/lib/partner-labels";
import { usePartnerRecords } from "@/lib/use-partner-records";

export default function PaymentsPage() {
  const { user } = useAuth();
  const { payments, loading } = usePartnerRecords(user?.email, user?.phone);

  return (
    <div>
      <SectionHeader
        title="My Payments"
        description="Your payment history across Seminar, Autism and Fellowship registrations and Foundation shop orders."
      />
      <PartnerPortalBadges user={user} className="mb-5" />

      {loading ? <p className="mb-4 text-sm text-text-muted">Loading synced payments…</p> : null}

      {payments.length ? (
        <div className="space-y-4">
          {payments.map((payment) => (
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
        </div>
      ) : (
        !loading && (
          <EmptyState
            title="No payments yet"
            description="Seminar, Autism and Fellowship payments linked to this email will appear here. Sample shop payments are not shown."
            cta={{ label: "My Event Registrations", href: "/account/registrations" }}
          />
        )
      )}
    </div>
  );
}
