"use client";

import EmptyState from "@/components/account/EmptyState";
import SectionHeader from "@/components/account/SectionHeader";

export default function LoyaltyPage() {
  return (
    <div>
      <SectionHeader
        title="Loyalty Points"
        description="Earn points on event registrations and shop orders, and redeem them against future bookings."
      />

      <div className="rounded-2xl border border-burgundy/15 bg-burgundy/5 p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
          Available Points
        </p>
        <p className="mt-2 text-5xl font-bold text-burgundy">0</p>
        <p className="mt-2 text-sm text-text-muted">
          Points appear here after a qualifying shop order or registration.
        </p>
      </div>

      <div className="mt-8">
        <EmptyState
          title="No points history yet"
          description="Sample loyalty transactions are not shown. Real points from Foundation shop orders will be listed here."
          cta={{ label: "Visit the shop", href: "/shop" }}
        />
      </div>
    </div>
  );
}
