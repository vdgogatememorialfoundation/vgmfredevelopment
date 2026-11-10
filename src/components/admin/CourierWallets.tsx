"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, Panel } from "@/components/admin/AdminUI";
import { getShipments } from "@/lib/admin-store";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { getIntegrations } from "@/lib/integrations";
import { readCourierWallets, type CourierWallet } from "@/lib/shipping-client";

const rupees = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const stamp = (value?: string) =>
  value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value)) : "—";

export default function CourierWallets() {
  useCommerceMirror();
  const [wallets, setWallets] = useState<CourierWallet[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string>();
  const [busy, setBusy] = useState(false);
  const floor = getIntegrations().shipping.minWalletRupees || 0;

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      setWallets(await readCourierWallets());
      setCheckedAt(new Date().toISOString());
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const spends = getShipments()
        .filter((shipment) => shipment.live && shipment.provider && shipment.provider !== "local")
        .map((shipment) => ({
          shipment,
          at: shipment.tracking?.[0]?.at,
          cost: shipment.courierCost ?? shipment.charges,
          cancelled: shipment.note === "Cancelled",
        }))
        .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
        .slice(0, 30);

  return (
    <div className="space-y-5">
      <Panel
        title="Courier wallets"
        description={`Live balance with each shipping aggregator. Booking stops when a wallet is below ₹${floor}. Updates every 5 minutes.`}
        action={
          <Button variant="outline" onClick={refresh} disabled={busy}>
            {busy ? "Checking…" : "Check now"}
          </Button>
        }
      >
        {!wallets ? (
          <EmptyState text="Reading wallets…" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {wallets.map((wallet) => {
              const low = wallet.balance !== undefined && wallet.balance < floor;
              return (
                <div key={wallet.provider} className={`rounded-xl border p-4 ${low ? "border-red-300 bg-red-50" : "border-border bg-white"}`}>
                  <p className="text-sm font-semibold text-text-primary">{wallet.label}</p>
                  {wallet.balance !== undefined ? (
                    <>
                      <p className={`mt-1 text-2xl font-bold ${low ? "text-red-700" : "text-emerald-700"}`}>{rupees(wallet.balance)}</p>
                      <p className="mt-1 text-xs text-text-muted">{low ? `Below ₹${floor}: top up in the ${wallet.label} dashboard before booking.` : "Ready for bookings."}</p>
                    </>
                  ) : wallet.connected ? (
                    <p className="mt-1 text-xs text-red-700">{wallet.error}</p>
                  ) : (
                    <p className="mt-1 text-xs text-text-muted">
                      Not connected. <Link href="/admin/settings/shipping-apis" className="font-semibold text-burgundy">Add keys in Shipping APIs</Link>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-text-muted">Last checked {stamp(checkedAt)}. A cancelled shipment is refunded to the wallet by the aggregator under its own policy.</p>
      </Panel>
      <Panel title="Recent courier charges" description="What each booked shipment cost from the wallet.">
        {!spends.length ? (
          <EmptyState text="No live courier bookings yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="py-2 pr-3">Booked</th>
                  <th className="py-2 pr-3">Aggregator</th>
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">AWB</th>
                  <th className="py-2 pr-3 text-right">Charge</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {spends.map(({ shipment, at, cost, cancelled }) => (
                  <tr key={shipment.id} className="border-t border-border">
                    <td className="py-2 pr-3">{stamp(at)}</td>
                    <td className="py-2 pr-3">{shipment.provider}</td>
                    <td className="py-2 pr-3">#{shipment.orderId}</td>
                    <td className="py-2 pr-3">{shipment.awb || "—"}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{rupees(cost)}</td>
                    <td className="py-2">{cancelled ? "Cancelled · refund to wallet" : shipment.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
