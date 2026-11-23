"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Panel, StatusBadge, ORDER_STATUS_TONES, formatINR } from "@/components/admin/AdminUI";
import OrderTrackingTimeline from "@/components/store/OrderTrackingTimeline";
import { getOrder, getShipments, hideShipmentScan, patchOrder } from "@/lib/admin-store";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { bookedViaLabel, customerCourierLabel } from "@/lib/courier-label";
import { deliveryDatePhrase, statusStamp } from "@/lib/delivery-expectation";
import { isDeskScan } from "@/lib/order-pipeline";
import { trackShipment } from "@/lib/shipping-client";
import { formatDateTime } from "@/lib/utils";

export default function AdminOrderTrackPage() {
  const params = useParams<{ id: string }>();
  const orderId = decodeURIComponent(String(params.id || "")).trim();
  const { version } = useCommerceMirror();
  const [extra, setExtra] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  void version;
  void extra;

  const order = getOrder(orderId);
  const shipment = getShipments().find((s) => s.orderId === orderId && s.note !== "Cancelled");
  const rawScans = (shipment?.tracking ?? []).filter((ev) => !isDeskScan(ev));

  const uniqueAdminUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/admin/commerce/orders/${encodeURIComponent(orderId)}/track`
      : `https://vaidyagogate.org/admin/commerce/orders/${encodeURIComponent(orderId)}/track`;

  useEffect(() => {
    if (!shipment?.id) return;
    // Automatically refresh live courier scans on load
    let active = true;
    setBusy(true);
    void trackShipment(shipment.id)
      .then((res) => {
        if (active && res) setExtra((v) => v + 1);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [shipment?.id]);

  const handleRefresh = async () => {
    if (!shipment?.id) return;
    setBusy(true);
    setNote("");
    try {
      const text = await trackShipment(shipment.id);
      setNote(`Live courier status: ${text}`);
      setExtra((v) => v + 1);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not refresh courier tracking.");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = () => {
    void navigator.clipboard?.writeText(uniqueAdminUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!order) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Admin Order Tracking · #{orderId}</h1>
          <Link href="/admin/commerce/orders" className="text-sm font-semibold text-burgundy underline">
            ← Back to All Orders
          </Link>
        </div>
        <Panel title="Order Not Found">
          <p className="text-sm text-text-muted">
            Order #{orderId} is still syncing or does not exist. Try refreshing in a moment.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Unique Admin Link Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-text-primary">Order #{order.id} · Live Admin Tracking</h1>
            <StatusBadge status={order.status} mapping={ORDER_STATUS_TONES} />
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {order.deliveryAddress?.fullName || "Customer"}
            {order.deliveryAddress?.phone ? ` · ${order.deliveryAddress.phone}` : ""}
            {order.deliveryAddress?.city ? ` · ${order.deliveryAddress.city}, ${order.deliveryAddress.state} ${order.deliveryAddress.pincode}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleCopy}>
            {copied ? "✓ Copied Admin Track Link" : "Copy Unique Admin Track Link"}
          </Button>
          {shipment ? (
            <Button disabled={busy} onClick={() => void handleRefresh()}>
              {busy ? "Fetching Courier Scans…" : `🔄 Refresh Live Scans (${rawScans.length})`}
            </Button>
          ) : null}
          <Link
            href={`/admin/commerce/orders?order=${encodeURIComponent(order.id)}`}
            className="inline-flex items-center rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-text-primary hover:bg-warm-cream"
          >
            Open Full Order Desk →
          </Link>
        </div>
      </div>

      {/* Unique Direct Link Box */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs">
        <p className="font-semibold uppercase tracking-wider text-blue-900">Unique Admin Order Tracking Link</p>
        <p className="mt-1 break-all font-mono text-sm font-semibold text-blue-800">{uniqueAdminUrl}</p>
      </div>

      {note ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">
          {note}
        </div>
      ) : null}

      {/* Summary Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Order & Payment">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-text-muted">Order Date</dt><dd className="font-medium">{formatDateTime(order.date)}</dd></div>
            <div className="flex justify-between"><dt className="text-text-muted">Total</dt><dd className="font-bold">{formatINR(order.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-text-muted">Payment</dt><dd className="font-semibold">{order.paymentStatus}</dd></div>
            <div className="flex justify-between"><dt className="text-text-muted">Delivery Mode</dt><dd className="font-medium">{order.deliveryMode === "store_pickup" ? "Store Pickup" : "Courier Delivery"}</dd></div>
          </dl>
          <div className="mt-3 border-t border-border pt-2 text-xs text-text-muted">
            {order.items.map((item, idx) => (
              <p key={`${item.bookId}-${idx}`} className="font-medium text-text-primary">
                {item.title} × {item.quantity} ({formatINR(item.price * item.quantity)})
              </p>
            ))}
          </div>
        </Panel>

        <Panel title="Courier & AWB Details">
          {shipment ? (
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">Courier</dt>
                <dd className="font-semibold">{customerCourierLabel({ provider: shipment.provider, courier: shipment.courier })}</dd>
              </div>
              {bookedViaLabel(shipment.provider) ? (
                <div className="flex justify-between"><dt className="text-text-muted">Booked Via</dt><dd className="font-medium">{bookedViaLabel(shipment.provider)}</dd></div>
              ) : null}
              <div className="flex justify-between"><dt className="text-text-muted">AWB</dt><dd className="font-mono font-bold text-burgundy">{shipment.awb}</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Shipment Status</dt><dd className="font-semibold">{shipment.status}</dd></div>
              <div className="flex justify-between"><dt className="text-text-muted">Expected Delivery</dt><dd className="font-medium">{deliveryDatePhrase(shipment.expectedBy) || "Pending from courier"}</dd></div>
              {shipment.agentName || shipment.agentPhone ? (
                <div className="flex justify-between"><dt className="text-text-muted">Delivery Agent</dt><dd className="font-medium">{[shipment.agentName, shipment.agentPhone].filter(Boolean).join(" · ")}</dd></div>
              ) : null}
              {shipment.trackingUrl ? (
                <div className="pt-2">
                  <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-burgundy underline">
                    Open Courier Website Tracking ↗
                  </a>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-text-muted">No courier shipment booked for this order yet.</p>
          )}
        </Panel>

        <Panel title={`Uploaded AWB Images (${order.awbPhotos?.length ?? 0})`}>
          {order.awbPhotos?.length ? (
            <div className="grid grid-cols-2 gap-2">
              {order.awbPhotos.map((photo) => (
                <figure key={photo.url} className="rounded-lg border border-border p-1.5 text-[11px]">
                  <a href={photo.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="AWB label" className="aspect-square w-full rounded object-cover" />
                  </a>
                  <figcaption className="mt-1 flex items-center justify-between gap-1">
                    <span className="truncate font-mono text-burgundy">{photo.awb || "AWB"}</span>
                    <button
                      type="button"
                      className="font-semibold text-red-600 hover:underline"
                      onClick={() => {
                        if (!window.confirm(`Delete this AWB image${photo.awb ? ` (${photo.awb})` : ""}? You will be able to upload a new one afterwards.`)) return;
                        patchOrder(order.id, { awbPhotos: (order.awbPhotos ?? []).filter((p) => p.url !== photo.url) }, `Deleted AWB photo`);
                        setExtra((v) => v + 1);
                      }}
                    >
                      Delete
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">No AWB label images uploaded yet.</p>
          )}
        </Panel>
      </div>

      {/* Detailed Raw Courier Scans Table */}
      {shipment ? (
        <Panel title={`Detailed Courier Scans & Hub Checkpoints (${rawScans.length})`}>
          {rawScans.length > 0 ? (
            <ol className="divide-y divide-border text-sm">
              {[...rawScans].reverse().map((event, idx) => (
                <li key={`${event.at}-${idx}`} className="flex flex-wrap items-baseline gap-3 py-2">
                  <span className="w-48 shrink-0 font-mono text-xs text-text-muted">{statusStamp(event.at)}</span>
                  <span className="flex-1 font-medium text-text-primary">
                    {event.status}
                    {event.location ? <span className="font-normal text-text-muted"> · {event.location}</span> : ""}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => {
                      if (window.confirm(`Remove "${event.status}" from this shipment's tracking?`)) {
                        setNote(hideShipmentScan(shipment.id, event));
                        setExtra((v) => v + 1);
                      }
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-text-muted">No courier scans recorded yet. Click Refresh Live Scans above.</p>
          )}
        </Panel>
      ) : null}

      {/* Full Detailed Visual Timeline */}
      <Panel title="Detailed Order & Courier Pipeline">
        <OrderTrackingTimeline order={order} detailed />
      </Panel>
    </div>
  );
}
