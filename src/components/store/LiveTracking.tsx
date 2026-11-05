"use client";

import { useEffect, useState } from "react";
import { getSettings } from "@/lib/admin-store";
import { getIntegrations } from "@/lib/integrations";
import { customerCourierLabel, customerStatusLabel, riderAccepted } from "@/lib/courier-label";
import { getPickupLocation } from "@/lib/fulfillment";
import { customerAddressLine, deliveryDatePhrase } from "@/lib/delivery-expectation";
import { isHyperlocalProvider } from "@/lib/order-pipeline";
import DeliveryMap from "@/components/store/DeliveryMap";
import type { Order, ShipmentRecord } from "@/types";

const DEFAULT_SCOOTER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#0B1F3A"/><path fill="#B8953A" d="M18 40a6 6 0 1 0 12 0 6 6 0 0 0-12 0zm20 0a6 6 0 1 0 12 0 6 6 0 0 0-12 0z"/><path fill="#F7F3EA" d="M22 28h10l4-8h8l-3 8h5v4H24z"/><path fill="#8F2D2D" d="M36 20h8l2 4h-8z"/></svg>`
  );

export default function LiveTracking({
  order,
  shipment,
  onArrival,
}: {
  order: Order;
  shipment?: ShipmentRecord | null;
  onArrival?: (text: string) => void;
}) {
  const [mapsKey, setMapsKey] = useState("");

  useEffect(() => {
    const local = getSettings().apiKeys.googleMaps?.trim() ?? "";
    if (local) setMapsKey(local);
    void fetch("/api/shop/maps-key", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ key?: string }>)
      .then((data) => {
        if (data.key) setMapsKey(data.key);
      })
      .catch(() => undefined);
  }, []);

  if (order.deliveryMode !== "delivery") return null;

  const provider = shipment?.provider ?? order.courierChoice?.provider;
  const hyperlocal = isHyperlocalProvider(provider, order.courierChoice?.lastMile, shipment?.courier || order.courierName);
  if (!hyperlocal || shipment?.directCourier) return null;
  const partner = customerCourierLabel({ provider, courier: shipment?.courier || order.courierName });
  const latest = [...(shipment?.tracking ?? [])].reverse().find((scan) => scan.status)?.status ?? shipment?.status ?? "";
  const status = customerStatusLabel(latest, provider);
  const pickup = getPickupLocation();
  const address = order.deliveryAddress;
  const dropAddress = customerAddressLine(address);
  const scooter = getIntegrations().shipping.scooterImage || DEFAULT_SCOOTER;
  const riderKnown = Boolean(shipment?.agentName?.trim()) || riderAccepted(status, shipment?.agentName);
  const leg = shipment?.agentLeg ?? (/picked up|out for|in transit/i.test(`${status} ${shipment?.status ?? ""}`) ? "delivery" : "pickup");
  const deliveryStarted = /picked up|out for|in transit|on the way|deliver/i.test(`${status} ${shipment?.status ?? ""}`) || shipment?.status === "Out for Delivery" || shipment?.status === "Delivered";
  const accepted = riderKnown && deliveryStarted;
  const agent =
    accepted && shipment?.agentLat != null && shipment?.agentLng != null
      ? { lat: shipment.agentLat, lng: shipment.agentLng }
      : undefined;

  return (
    <DeliveryMap
      mapsKey={mapsKey}
      partner={partner}
      status={status}
      accepted={accepted}
      leg={leg}
      scooter={scooter}
      store={{ lat: shipment?.pickupLat, lng: shipment?.pickupLng, label: pickup.name, address: pickup.address }}
      drop={{
        lat: shipment?.dropLat,
        lng: shipment?.dropLng,
        label: address?.place === "office" ? "Office" : "Home",
        address: dropAddress,
      }}
      agent={agent}
      agentName={accepted ? shipment?.agentName : undefined}
      agentPhone={accepted ? shipment?.agentPhone : undefined}
      showCourier={accepted}
      promised={deliveryDatePhrase(shipment?.expectedBy)}
      onArrival={onArrival}
    />
  );
}
