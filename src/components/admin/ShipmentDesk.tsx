"use client";

import { useState } from "react";
import { Button, Panel } from "@/components/admin/AdminUI";
import { RatesTable } from "@/components/admin/SettingsDesks";
import { getShipments } from "@/lib/admin-store";
import { getOrders } from "@/lib/store";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { bookShipment, fetchCourierRates, orderWeightKg, type RateQuote } from "@/lib/shipping-client";
import { formatDate } from "@/lib/utils";
import type { Order } from "@/types";

const READY = new Set(["Packed", "Ready to Ship", "To Ship"]);

/** Packed delivery orders without a courier: staff with "Create shipments" pick the courier and book. */
export function ShipmentDesk() {
  const { version } = useCommerceMirror();
  void version;
  const booked = new Set(getShipments().filter((item) => item.note !== "Cancelled").map((item) => item.orderId));
  const orders = getOrders().filter((order) => order.deliveryMode === "delivery" && READY.has(order.status) && !booked.has(order.id));
  return (
    <Panel title="Ready to ship" description="Packed orders waiting for a courier. Check rates, choose the courier partner and book the shipment. Pre-orders appear here once packed.">
      {orders.length ? (
        <div className="space-y-3">
          {orders.map((order) => (
            <ReadyOrder key={order.id} order={order} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted">No packed orders are waiting for a courier.</p>
      )}
    </Panel>
  );
}

function ReadyOrder({ order }: { order: Order }) {
  const [quote, setQuote] = useState<RateQuote | null>(null);
  const [picked, setPicked] = useState<number | undefined>();
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const run = async (name: string, task: () => Promise<string>) => {
    setBusy(name);
    setNote("");
    try {
      setNote(await task());
    } catch (problem) {
      setNote(problem instanceof Error ? problem.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  };
  const address = order.deliveryAddress;
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-text-primary">Order {order.id} · {order.status}</p>
          <p className="text-xs text-text-muted">
            {formatDate(order.date)} · {address?.fullName} · {[address?.city, address?.pincode].filter(Boolean).join(" ")} · {order.items.map((item) => `${item.title} × ${item.quantity}`).join(", ")}
          </p>
          {order.courierChoice?.courierName && <p className="text-xs text-text-muted">Customer chose {order.courierChoice.courierName}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy === "rates"}
            onClick={() =>
              run("rates", async () => {
                const result = await fetchCourierRates({
                  deliveryPincode: address?.pincode ?? "",
                  weightKg: orderWeightKg(order),
                  declaredValue: order.total,
                  cod: order.paymentMethod === "Cash on delivery" && order.paymentStatus !== "Paid",
                  bookIds: order.items.map((item) => item.bookId),
                  dims: order.parcel,
                });
                setQuote(result);
                setPicked(undefined);
                return result.rates.length ? "Choose a courier partner." : "No courier serves this pincode.";
              })
            }
          >
            {busy === "rates" ? "Checking…" : "Show couriers & rates"}
          </Button>
          <Button
            disabled={busy === "book"}
            onClick={() => run("book", async () => (await bookShipment(order.id, picked !== undefined ? quote?.rates[picked] : undefined)).message)}
          >
            {busy === "book" ? "Booking…" : picked !== undefined && quote ? `Book ${quote.rates[picked]?.courierName}` : "Book customer's courier"}
          </Button>
        </div>
      </div>
      {quote && <RatesTable quote={quote} picked={picked} onPick={setPicked} />}
      {note && <p className="mt-2 text-xs text-text-muted">{note}</p>}
    </div>
  );
}
