"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminModal } from "@/components/admin/AdminModal";
import { Button, SelectInput } from "@/components/admin/AdminUI";
import { bookShipment, fetchCourierRates, orderWeightKg } from "@/lib/shipping-client";
import { getOrder } from "@/lib/admin-store";
import type { CourierRate, Order } from "@/types";

const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
const courierKey = (rate: Pick<CourierRate, "provider" | "courierId">) => `${rate.provider}:${rate.courierId}`;

type Quote = { order: Order; rates: CourierRate[]; note?: string };

/** Ships the selected orders with one courier; orders it does not serve are left unshipped. */
export function BulkShipCourier({ orderIds, onClose, onDone }: { orderIds: string[]; onClose: () => void; onDone: (note: string) => void }) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const rows: Quote[] = [];
      for (const id of orderIds) {
        const order = getOrder(id);
        if (!order) continue;
        if (order.deliveryMode !== "delivery") {
          rows.push({ order, rates: [], note: "Store pickup, no courier" });
          continue;
        }
        const quote = await fetchCourierRates({
          deliveryPincode: order.deliveryAddress?.pincode ?? "",
          weightKg: orderWeightKg(order),
          declaredValue: order.total,
          cod: order.paymentMethod === "Cash on delivery",
          bookIds: order.items.map((item) => item.bookId),
          dims: order.parcel,
        }).catch(() => ({ rates: [] as CourierRate[], notes: ["Rates could not be fetched"] }));
        rows.push({ order, rates: quote.rates, note: quote.rates.length ? undefined : quote.notes[0] });
      }
      if (live) setQuotes(rows);
    })();
    return () => {
      live = false;
    };
  }, [orderIds]);

  const couriers = useMemo(() => {
    const map = new Map<string, { label: string; served: number; total: number }>();
    for (const quote of quotes ?? []) {
      for (const rate of quote.rates) {
        const key = courierKey(rate);
        const row = map.get(key) ?? { label: rate.courierName, served: 0, total: 0 };
        row.served += 1;
        row.total += rate.rate;
        map.set(key, row);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].served - a[1].served || a[1].total - b[1].total);
  }, [quotes]);

  const rateFor = (quote: Quote) => quote.rates.find((rate) => courierKey(rate) === chosen);
  const ready = (quotes ?? []).filter((quote) => rateFor(quote));

  const ship = async () => {
    setBusy(true);
    let booked = 0;
    const failed: string[] = [];
    for (const quote of ready) {
      try {
        await bookShipment(quote.order.id, rateFor(quote));
        booked += 1;
      } catch (error) {
        failed.push(`${quote.order.id}: ${error instanceof Error ? error.message : "could not book"}`);
      }
    }
    const skipped = (quotes ?? []).length - ready.length;
    setBusy(false);
    onDone([`${booked} shipped with ${couriers.find(([key]) => key === chosen)?.[1].label ?? "the courier"}`, skipped ? `${skipped} not served, left unshipped` : "", ...failed].filter(Boolean).join(" · "));
  };

  return (
    <AdminModal title="Ship with one courier" wide onClose={onClose}>
      {!quotes ? (
        <p className="text-sm text-text-muted">Fetching courier charges for {orderIds.length} order{orderIds.length === 1 ? "" : "s"}…</p>
      ) : (
        <div className="space-y-4">
          <SelectInput value={chosen} onChange={(event) => setChosen(event.target.value)}>
            <option value="">Choose a courier</option>
            {couriers.map(([key, row]) => (
              <option key={key} value={key}>
                {row.label} · serves {row.served} of {quotes.length} · total {rupees(Math.round(row.total))}
              </option>
            ))}
          </SelectInput>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-text-muted">
                <tr><th className="py-2 pr-3">Order</th><th className="py-2 pr-3">Pincode</th><th className="py-2 pr-3">Charge</th><th className="py-2">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quotes.map((quote) => {
                  const rate = rateFor(quote);
                  return (
                    <tr key={quote.order.id}>
                      <td className="py-2 pr-3 font-mono">{quote.order.id}</td>
                      <td className="py-2 pr-3">{quote.order.deliveryAddress?.pincode ?? "—"}</td>
                      <td className="py-2 pr-3">{rate ? rupees(rate.rate) : "—"}</td>
                      <td className={`py-2 ${rate ? "text-emerald-700" : "text-red-700"}`}>
                        {!chosen ? quote.note ?? `${quote.rates.length} courier${quote.rates.length === 1 ? "" : "s"}` : rate ? `Will ship${rate.etaDays ? ` · ${rate.etaDays} days` : ""}` : quote.note ?? "Not served by this courier, won't ship"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {chosen && (
            <p className="text-sm text-text-primary">
              Total charge <b>{rupees(Math.round(ready.reduce((sum, quote) => sum + (rateFor(quote)?.rate ?? 0), 0)))}</b> for {ready.length} order{ready.length === 1 ? "" : "s"}.
            </p>
          )}
          <div className="flex gap-2">
            <Button disabled={!ready.length || busy} onClick={() => void ship()}>{busy ? "Shipping…" : `Ship ${ready.length} order${ready.length === 1 ? "" : "s"}`}</Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </AdminModal>
  );
}
