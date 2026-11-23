"use client";

import { useMemo, useState } from "react";
import {
  getShipments,
  hideShipmentScan,
  patchOrder,
  removeOrderShipments,
  updateShipmentStatus,
} from "@/lib/admin-store";
import { downloadLabel, trackShipment } from "@/lib/shipping-client";
import LabelSizePicker from "@/components/admin/LabelSizePicker";
import { getOrder } from "@/lib/admin-store";
import type { ShipmentRecord } from "@/types";
import {
  Button,
  EmptyState,
  LinkText,
  Panel,
  SelectInput,
  StatusBadge,
  formatINR,
} from "@/components/admin/AdminUI";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { bookedViaLabel, customerCourierLabel } from "@/lib/courier-label";
import { deliveryDatePhrase, statusStamp } from "@/lib/delivery-expectation";
import { isDeskScan } from "@/lib/order-pipeline";
import { formatDate } from "@/lib/utils";

const SHIPMENT_TONES: Record<string, string> = {
  Booked: "bg-warm-cream text-burgundy",
  "Picked Up": "bg-burgundy/10 text-burgundy",
  "In Transit": "bg-amber-50 text-amber-700",
  "Out for Delivery": "bg-burgundy/10 text-burgundy",
  Delivered: "bg-emerald-50 text-emerald-700",
  Failed: "bg-red-50 text-red-700",
};

export function ShipmentsSection() {
  const { version } = useCommerceMirror();
  const [extra, setExtra] = useState(0);
  const shipments = useMemo(() => getShipments().filter((item) => item.note !== "Cancelled"), [version, extra]);
  const refresh = () => setExtra((value) => value + 1);
  const [labelNote, setLabelNote] = useState("");
  const [trackingBusyId, setTrackingBusyId] = useState("");

  const handleTrackRefresh = async (shipment: ShipmentRecord) => {
    setTrackingBusyId(shipment.id);
    try {
      const statusText = await trackShipment(shipment.id);
      setLabelNote(`Order #${shipment.orderId} (${shipment.awb}): ${statusText}`);
      refresh();
    } catch (problem) {
      setLabelNote(problem instanceof Error ? problem.message : "Could not fetch courier updates.");
    } finally {
      setTrackingBusyId("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Shipments &amp; Live Courier Updates</h1>
          <p className="text-sm text-text-muted">
            Courier bookings, AWB numbers, live hub-by-hub courier scan history, charges and shipping labels.
          </p>
        </div>
      </div>
      {labelNote && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><LinkText text={labelNote} /></p>}

      {shipments.length === 0 ? (
        <Panel title="Shipments"><EmptyState text="Book a shipment from an order to see it here." /></Panel>
      ) : (
        <Panel title={`${shipments.length} shipments`}>
          <ul className="space-y-4">
            {shipments.map((shipment) => {
              const order = getOrder(shipment.orderId);
              const rawScans = (shipment.tracking ?? []).filter((event) => !isDeskScan(event));
              const latestScan = [...rawScans].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
              const via = bookedViaLabel(shipment.provider);
              return (
                <li key={shipment.id} className="rounded-xl border border-border bg-white p-4 shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text-primary">
                        #{shipment.orderId} — {customerCourierLabel({ provider: shipment.provider, courier: shipment.courier })}
                        {via ? <span className="ml-1.5 text-xs font-normal text-text-muted">({via}{shipment.live ? " · live API" : ""})</span> : null}
                      </p>
                      <p className="font-mono text-xs font-semibold text-burgundy">
                        AWB {shipment.awb}
                        {shipment.providerOrderId ? ` · Provider Order ${shipment.providerOrderId}` : ""}
                        {shipment.providerShipmentId ? ` · Shipment ${shipment.providerShipmentId}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={shipment.status} mapping={SHIPMENT_TONES} />
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-text-muted">
                    {shipment.toAddress.fullName} · {shipment.toAddress.city}, {shipment.toAddress.state} {shipment.toAddress.pincode}
                    {" · "}Charges {formatINR(shipment.charges)}
                    {" · "}Booked {formatDate(shipment.generatedAt)}
                    {shipment.expectedBy ? ` · Expected Delivery: ${deliveryDatePhrase(shipment.expectedBy) || shipment.expectedBy}` : ""}
                  </p>

                  {(shipment.agentName || shipment.agentPhone || shipment.deliveryOtp) ? (
                    <p className="mt-1 text-xs font-medium text-emerald-800">
                      Delivery Agent: {[shipment.agentName, shipment.agentPhone].filter(Boolean).join(" · ")}
                      {shipment.deliveryOtp ? ` · OTP ${shipment.deliveryOtp}` : ""}
                    </p>
                  ) : null}

                  {latestScan ? (
                    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs">
                      <span className="font-semibold text-blue-950">Latest Courier Scan:</span>{" "}
                      <span className="font-bold text-blue-900">{latestScan.status}</span>
                      {latestScan.location ? <span className="text-blue-800"> · {latestScan.location}</span> : null}
                      <span className="ml-2 text-blue-700">({statusStamp(latestScan.at)})</span>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SelectInput
                      className="w-40"
                      value={shipment.status}
                      onChange={(e) => {
                        updateShipmentStatus(shipment.id, e.target.value as ShipmentRecord["status"]);
                        refresh();
                      }}
                    >
                      {["Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered", "Failed"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </SelectInput>
                    <Button
                      variant="outline"
                      disabled={trackingBusyId === shipment.id}
                      onClick={() => void handleTrackRefresh(shipment)}
                    >
                      {trackingBusyId === shipment.id ? "Fetching scans…" : `🔄 Fetch Live Courier Updates (${rawScans.length})`}
                    </Button>
                    <LabelSizePicker />
                    <Button variant="ghost" onClick={() => void downloadLabel(shipment.id).then(setLabelNote).catch((problem) => setLabelNote(problem instanceof Error ? problem.message : "Could not make the label."))}>
                      Make label link
                    </Button>
                    {shipment.labelLink && <a href={shipment.labelLink} download className="inline-flex items-center rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 underline">Download label</a>}
                    <a href={`/admin/commerce/orders/${encodeURIComponent(shipment.orderId)}/track`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg border border-blue-600 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-100">🔗 Admin Track Link ↗</a>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (!window.confirm(`Delete the shipment for order #${shipment.orderId}? The order stays; its AWB is removed.`)) return;
                        removeOrderShipments(shipment.orderId);
                        if (order) patchOrder(order.id, { shipmentId: undefined, trackingId: "" }, `Shipment ${shipment.awb || shipment.id} deleted`);
                        refresh();
                      }}
                    >
                      Delete shipment
                    </Button>
                    <span className="text-xs text-text-muted">
                      {order ? `${order.items.length} item(s)` : ""} · ₹{order?.total ?? 0}
                    </span>
                  </div>

                  {/* Shipment AWB Images (with Delete) */}
                  {order?.awbPhotos?.length ? (
                    <div className="mt-3 rounded-xl border border-border bg-white p-3 text-xs">
                      <p className="font-semibold text-text-primary">
                        Uploaded Shipment AWB Images ({order.awbPhotos.length})
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {order.awbPhotos.map((photo) => {
                          const norm = (v?: string) => String(v || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
                          const isCurrent = (photo.shipmentId && photo.shipmentId === shipment.id) || (shipment.awb && norm(photo.awb) === norm(shipment.awb));
                          return (
                            <figure key={photo.url} className={`rounded-lg border p-1.5 ${isCurrent ? "border-emerald-400 bg-emerald-50/30" : "border-border bg-slate-50"}`}>
                              <a href={photo.url} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={photo.url} alt="AWB label" className="aspect-square w-full rounded object-cover" />
                              </a>
                              <figcaption className="mt-1 space-y-0.5 text-[11px] text-text-muted">
                                <div className="flex items-center justify-between gap-1">
                                  <span className={`rounded px-1 py-0.5 text-[10px] font-bold uppercase ${isCurrent ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                                    {isCurrent ? "Active" : "Previous"}
                                  </span>
                                  <button
                                    type="button"
                                    className="font-semibold text-red-600 hover:underline"
                                    onClick={() => {
                                      if (!window.confirm(`Delete this AWB image${photo.awb ? ` (AWB ${photo.awb})` : ""}? You will be able to upload a new image for this courier afterwards.`)) return;
                                      const nextPhotos = (order.awbPhotos ?? []).filter((item) => item.url !== photo.url);
                                      patchOrder(order.id, { awbPhotos: nextPhotos }, `Deleted AWB photo${photo.awb ? ` (AWB ${photo.awb})` : ""}`);
                                      setLabelNote(`Deleted AWB image for order #${order.id}.`);
                                      refresh();
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                                {photo.awb ? <p className="truncate font-mono text-burgundy">AWB {photo.awb}</p> : null}
                                {photo.courier ? <p className="truncate">{photo.courier}</p> : null}
                              </figcaption>
                            </figure>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Detailed Courier Scan Log Table */}
                  <div className="mt-3 rounded-xl border border-border bg-warm-cream/40 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-text-primary">
                        Detailed Courier Scans &amp; Hub Checkpoints ({rawScans.length})
                      </p>
                      {shipment.trackingUrl ? (
                        <a
                          href={shipment.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-burgundy underline"
                        >
                          Open Courier Tracking Page ↗
                        </a>
                      ) : null}
                    </div>
                    {rawScans.length > 0 ? (
                      <ol className="mt-2 space-y-1.5 border-t border-border pt-2">
                        {[...rawScans].reverse().map((event, idx) => (
                          <li key={`${event.at}-${idx}`} className="flex flex-wrap items-baseline gap-2">
                            <span className="w-44 shrink-0 font-mono text-[11px] text-text-muted">{statusStamp(event.at)}</span>
                            <span className="flex-1 font-medium text-text-primary">
                              {event.status}
                              {event.location ? <span className="font-normal text-text-muted"> · {event.location}</span> : ""}
                            </span>
                            <button
                              type="button"
                              className="text-[11px] text-red-600 hover:underline"
                              onClick={() => {
                                if (window.confirm(`Remove "${event.status}" from this shipment's tracking?`)) {
                                  setLabelNote(hideShipmentScan(shipment.id, event));
                                  refresh();
                                }
                              }}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-1.5 text-text-muted">
                        No courier scans recorded yet. Click &ldquo;Fetch Live Courier Updates&rdquo; above to pull the latest scans from {shipment.courier}.
                      </p>
                    )}
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
