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

const RECHARGE_URLS: Record<string, string> = {
  shiprocket: "https://app.shiprocket.in/",
  nimbuspost: "https://ship.nimbuspost.com/",
  ithink: "https://my.ithinklogistics.com/",
  shipyaari: "https://seller.shipyaari.com/",
};

export default function CourierWallets() {
  useCommerceMirror();
  const [wallets, setWallets] = useState<CourierWallet[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [watchUntil, setWatchUntil] = useState(0);
  const [rechargeNote, setRechargeNote] = useState("");
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

  useEffect(() => {
    if (!watchUntil) return;
    const timer = window.setInterval(() => {
      if (Date.now() > watchUntil) {
        setWatchUntil(0);
        return;
      }
      void refresh();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [watchUntil, refresh]);

  const recharge = (wallet: CourierWallet) => {
    const amount = Math.max(0, Math.round(Number(amounts[wallet.provider] || 0)));
    if (amount < 1) return setRechargeNote(`Enter the amount to add to ${wallet.label}.`);
    void navigator.clipboard?.writeText(String(amount)).catch(() => undefined);
    window.open(RECHARGE_URLS[wallet.provider], "_blank", "noopener,noreferrer");
    setWatchUntil(Date.now() + 10 * 60 * 1000);
    setRechargeNote(`₹${amount} copied. Finish the payment in ${wallet.label} (Wallet → Recharge). This page checks the new balance every 30 seconds for 10 minutes.`);
  };

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
          {rechargeNote && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{rechargeNote}</p>}
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
                  ) : null}
                  {wallet.connected && RECHARGE_URLS[wallet.provider] ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {[500, 1000, 2500, 5000].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setAmounts((current) => ({ ...current, [wallet.provider]: String(value) }))}
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${amounts[wallet.provider] === String(value) ? "border-burgundy bg-burgundy/10 text-burgundy" : "border-border text-text-muted hover:bg-surface"}`}
                          >
                            ₹{value.toLocaleString("en-IN")}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          aria-label={`Recharge amount for ${wallet.label}`}
                          placeholder="Amount ₹"
                          value={amounts[wallet.provider] ?? ""}
                          onChange={(event) => setAmounts((current) => ({ ...current, [wallet.provider]: event.target.value }))}
                          className="w-28 rounded-lg border border-border px-2 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => recharge(wallet)}
                          className="flex-1 rounded-lg bg-burgundy px-3 py-1.5 text-xs font-semibold text-white hover:bg-burgundy/90"
                        >
                          Recharge{amounts[wallet.provider] ? ` ₹${Number(amounts[wallet.provider]).toLocaleString("en-IN")}` : ""} on {wallet.label}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {wallet.balance !== undefined ? null : wallet.connected ? (
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
