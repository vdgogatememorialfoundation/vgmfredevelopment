"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import OrderTrackingTimeline from "@/components/store/OrderTrackingTimeline";
import { rememberOrder, rememberShipment } from "@/lib/commerce-sync";
import type { Order, ShipmentRecord } from "@/types";

export default function SharedTrackPage() {
  const params = useParams<{ token: string }>();
  const token = String(params.token || "");
  const [order, setOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState("Loading the shipment…");

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/track/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { ok?: boolean; order?: Order; shipment?: ShipmentRecord | null; error?: string };
        if (cancelled) return;
        if (!response.ok || !data.order) {
          setMessage(data.error || "This tracking link is not valid.");
          setOrder(null);
          return;
        }
        rememberOrder(data.order);
        if (data.shipment) rememberShipment(data.shipment);
        setOrder(data.order);
        setMessage("");
      })
      .catch(() => {
        if (!cancelled) setMessage("Tracking could not be loaded. Try the link again.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="container py-8">
      <h1 className="font-serif text-3xl text-ink">Shipment tracking</h1>
      {message ? <p className="mt-4 text-sm text-text-muted">{message}</p> : null}
      {order ? (
        <div className="mt-6">
          <OrderTrackingTimeline order={order} phone={order.deliveryAddress?.phone ?? ""} />
        </div>
      ) : null}
    </div>
  );
}
