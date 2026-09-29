"use client";

import Badge from "@/components/common/Badge";
import SectionHeader from "@/components/account/SectionHeader";

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
  return (
    <div>
      <SectionHeader
        title="My Payments"
        description="Your payment history across event registrations and shop orders."
      />

      <div className="space-y-4">
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