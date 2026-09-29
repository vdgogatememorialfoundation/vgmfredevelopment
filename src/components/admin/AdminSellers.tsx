"use client";

import { useState } from "react";
import {
  approveSeller,
  getSellers,
  rejectSeller,
} from "@/lib/admin-store";
import type { Seller } from "@/types";
import {
  Button,
  EmptyState,
  Panel,
  StatusBadge,
  formatINR,
} from "@/components/admin/AdminUI";
import { formatDate } from "@/lib/utils";

const SELLER_STATUS_TONES: Record<string, string> = {
  Onboarding: "bg-warm-cream text-text-muted",
  "OTP Pending": "bg-amber-50 text-amber-700",
  "KYC Pending": "bg-amber-50 text-amber-700",
  "Under Review": "bg-burgundy/10 text-burgundy",
  Active: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-600",
};

export function SellersSection() {
  const [sellers, setSellers] = useState<Seller[]>(() => getSellers());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = () => setSellers(getSellers());
  const selected = sellers.find((s) => s.id === selectedId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Seller onboarding</h1>
        <p className="text-sm text-text-muted">
          Review KYC, activate sellers (12-digit seller id issued automatically) and track agreements.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title={`Sellers (${sellers.length})`}>
          {sellers.length === 0 ? (
            <EmptyState text="No seller applications yet. Sellers sign up from the seller portal (/seller)." />
          ) : (
            <ul className="divide-y divide-border">
              {sellers.map((seller) => (
                <li key={seller.id}>
                  <button type="button" onClick={() => setSelectedId(seller.id)} className="flex w-full items-center justify-between gap-2 py-3 text-left hover:bg-warm-cream/40">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-text-primary">{seller.brandName}</span>
                      <span className="block text-xs text-text-muted">{seller.email}</span>
                    </span>
                    <StatusBadge status={seller.status} mapping={SELLER_STATUS_TONES} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="lg:col-span-4">
          {selected ? (
            <Panel title={`${selected.brandName}`} description={`Seller ID: ${selected.id}`} action={<StatusBadge status={selected.status} mapping={SELLER_STATUS_TONES} />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Detail label="Contact">
                  {selected.firstName} {selected.middleName} {selected.lastName}
                </Detail>
                <Detail label="Phone">{selected.phone}</Detail>
                <Detail label="Email"><span className={selected.emailVerified ? "text-emerald-700" : ""}>{selected.email} {selected.emailVerified ? "✓" : "(unverified)"}</span></Detail>
                <Detail label="Category">{selected.category || "—"}</Detail>
                <Detail label="Joined">{formatDate(selected.createdAt)}</Detail>
                <Detail label="Payouts received">{formatINR(selected.payoutsReceived)}</Detail>
              </div>

              <div className="mt-4 rounded-xl bg-warm-cream/60 p-4 text-sm">
                <p className="font-semibold text-text-primary">KYC status: {selected.kyc.status}</p>
                {selected.kyc.docs.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-text-muted">
                    {selected.kyc.docs.map((doc) => (
                      <li key={doc.submittedAt + doc.kind}>• {doc.kind}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-text-muted">Agreement: {selected.agreement.status}{selected.agreement.signedAt ? " · " + formatDate(selected.agreement.signedAt) : ""}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="success" disabled={selected.status === "Active"} onClick={() => { approveSeller(selected.id); refresh(); }}>
                  {selected.status === "Active" ? "Active" : "Approve & issue seller id"}
                </Button>
                <Button variant="danger" disabled={selected.status === "Rejected"} onClick={() => { rejectSeller(selected.id); refresh(); }}>
                  Reject
                </Button>
                <Button variant="outline" onClick={() => setSelectedId(null)}>Close</Button>
              </div>
            </Panel>
          ) : (
            <Panel title="Seller details">
              <EmptyState text="Select an application to review and approve." />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <p className="text-sm font-medium text-text-primary">{children}</p>
    </div>
  );
}