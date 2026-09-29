"use client";

import { useState } from "react";
import {
  getShipments,
  printShippingLabel,
  updateShipmentStatus,
} from "@/lib/admin-store";
import { getOrder } from "@/lib/admin-store";
import type { ShipmentRecord } from "@/types";
import {
  Button,
  EmptyState,
  Panel,
  SelectInput,
  StatusBadge,
  formatINR,
} from "@/components/admin/AdminUI";
import { formatDate } from "@/lib/utils";

const SHIPMENT_TONES: Record<string, string> = {
  Booked: "bg-warm-cream text-burgundy",
  "Picked Up": "bg-burgundy/10 text-burgundy",
  "In Transit": "bg-amber-50 text-amber-700",
  "Out for Delivery": "bg-burgundy/10 text-burgundy",
  Delivered: "bg-emerald-50 text-emerald-700",
};

export function ShipmentsSection() {
  const [shipments, setShipments] = useState<ShipmentRecord[]>(() => getShipments());
  const refresh = () => setShipments(getShipments());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Shipments</h1>
        <p className="text-sm text-text-muted">
          Courier bookings, AWB numbers, charges and shipping labels.
        </p>
      </div>

      {shipments.length === 0 ? (
        <Panel title="Shipments"><EmptyState text="Book a shipment from an order to see it here." /></Panel>
      ) : (
        <Panel title={`${shipments.length} shipments`}>
          <ul className="space-y-3">
            {shipments.map((shipment) => {
              const order = getOrder(shipment.orderId);
              return (
                <li key={shipment.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text-primary">
                        #{shipment.orderId} — {shipment.courier}
                      </p>
                      <p className="font-mono text-xs text-burgundy">AWB {shipment.awb}</p>
                    </div>
                    <StatusBadge status={shipment.status} mapping={SHIPMENT_TONES} />
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    {shipment.toAddress.fullName} · {shipment.toAddress.city} {shipment.toAddress.pincode}
                    {" · "}Charges {formatINR(shipment.charges)}
                    {" · "}Generated {formatDate(shipment.generatedAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SelectInput
                      className="w-40"
                      value={shipment.status}
                      onChange={(e) => {
                        updateShipmentStatus(shipment.id, e.target.value as ShipmentRecord["status"]);
                        refresh();
                      }}
                    >
                      {["Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </SelectInput>
                    <Button variant="ghost" onClick={() => printShippingLabel(shipment)}>
                      Shipping label
                    </Button>
                    <span className="text-xs text-text-muted">
                      {order ? `${order.items.length} item(s)` : ""} · ₹{order?.total ?? 0}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}