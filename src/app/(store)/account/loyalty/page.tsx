import SectionHeader from "@/components/account/SectionHeader";

const demoTransactions = [
  { label: "Shop order VGMF-ORD-2026-1201", points: 69, date: "2026-09-02" },
  { label: "Shop order VGMF-ORD-2026-1042", points: 85, date: "2026-08-30" },
  { label: "Event registration bonus", points: 50, date: "2026-07-12" },
  { label: "Redeemed against registration", points: -84, date: "2026-06-20" },
];

export default function LoyaltyPage() {
  const balance = 120;

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
        <p className="mt-2 text-5xl font-bold text-burgundy">{balance}</p>
        <p className="mt-2 text-sm text-text-muted">
          Equivalent to ₹{balance} in credits to redeem at checkout.
        </p>
      </div>

      <h2 className="heading-3 mb-4 mt-8">Points History</h2>
      <div className="space-y-3">
        {demoTransactions.map((tx) => (
          <div
            key={tx.label}
            className="card flex items-center justify-between gap-4 p-5"
          >
            <div>
              <p className="text-sm font-medium text-text-primary">
                {tx.label}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{tx.date}</p>
            </div>
            <span
              className={
                tx.points >= 0
                  ? "text-sm font-bold text-emerald-600"
                  : "text-sm font-bold text-red-600"
              }
            >
              {tx.points >= 0 ? "+" : ""}
              {tx.points} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}