"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, SelectInput, TextInput } from "@/components/admin/AdminUI";
import VerticalPipeline, { type PipelineStageShape } from "@/components/tracking/VerticalPipeline";
import {
  advanceReturnRequest,
  getOrders,
  getReturnRequest,
  getReturnRequests,
  initiateReturn,
  recordReturnInspection,
  reviewReplacementRequest,
  sendReplacementAfterInspection,
  updateReturnRequest,
} from "@/lib/store";
import { getShipments, patchOrder } from "@/lib/admin-store";
import { emailReturnLabel } from "@/lib/payments-client";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { createReturnShipment } from "@/lib/shipping-client";
import { statusStamp } from "@/lib/delivery-expectation";
import { formatDateTime } from "@/lib/utils";
import type { Order, ReturnRequest } from "@/types";

type StatusFilter = "all" | "pending" | "in_progress" | "closed";
type SectionView = "both" | "return" | "replacement";

function rupees(n?: number) {
  return `₹${Math.round(Number(n || 0)).toLocaleString("en-IN")}`;
}

export default function AdminReturnsDesk({ defaultSection = "both" }: { defaultSection?: SectionView }) {
  useCommerceMirror();
  const [, setTick] = useState(0);
  const [sectionView, setSectionView] = useState<SectionView>(defaultSection);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState("");
  const [banner, setBanner] = useState<{ text: string; err?: boolean } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [courierMap, setCourierMap] = useState<Record<string, "vgmf-express" | "shiprocket" | "ithink">>({});
  const [qcNotes, setQcNotes] = useState<Record<string, string>>({});
  const [qcRestock, setQcRestock] = useState<Record<string, boolean>>({});
  const [newOrderId, setNewOrderId] = useState("");
  const [newKind, setNewKind] = useState<"replacement" | "return">(defaultSection === "return" ? "return" : "replacement");
  const [newReason, setNewReason] = useState("Product damaged");

  useEffect(() => {
    const refresh = () => setTick((v) => v + 1);
    window.addEventListener("vgmf-cms", refresh);
    window.addEventListener("storage", refresh);
    const t = window.setInterval(refresh, 12000);
    return () => {
      window.removeEventListener("vgmf-cms", refresh);
      window.removeEventListener("storage", refresh);
      window.clearInterval(t);
    };
  }, []);

  const allOrders = getOrders();
  const allShipments = getShipments();
  const localReturns = getReturnRequests();

  const rows = useMemo(() => {
    const list: { order: Order; request: ReturnRequest }[] = [];
    for (const order of allOrders) {
      const req = order.returnRequest ?? localReturns[order.id] ?? getReturnRequest(order.id);
      if (req) list.push({ order, request: req });
    }
    return list.sort((a, b) => String(b.request.requestedAt || b.order.date).localeCompare(String(a.request.requestedAt || a.order.date)));
  }, [allOrders, localReturns]);

  const counts = useMemo(() => {
    let pending = 0;
    let replacement = 0;
    let ret = 0;
    let inProgress = 0;
    let closed = 0;
    for (const { request } of rows) {
      if (request.kind === "replacement") replacement++;
      else ret++;
      if (request.status === "Pending Review" || request.status === "Return Requested") pending++;
      else if (["Return Approved", "Accepted", "Pickup Scheduled", "Picked Up", "At Return Hub", "In Transit", "Out for Seller Delivery", "Received by Seller"].includes(request.status)) inProgress++;
      else closed++;
    }
    return { total: rows.length, pending, replacement, ret, inProgress, closed };
  }, [rows]);

  const matchesSearchAndStatus = ({ order, request }: { order: Order; request: ReturnRequest }) => {
    if (statusFilter === "pending" && request.status !== "Pending Review" && request.status !== "Return Requested") return false;
    if (statusFilter === "in_progress" && !["Return Approved", "Accepted", "Pickup Scheduled", "Picked Up", "At Return Hub", "In Transit", "Out for Seller Delivery", "Received by Seller"].includes(request.status)) return false;
    if (statusFilter === "closed" && !["Refunded", "Replacement Created", "Rejected"].includes(request.status)) return false;
    const query = q.trim().toLowerCase();
    if (!query) return true;
    const hay = [
      order.id,
      request.id,
      request.reason,
      request.status,
      request.replacementOrderId,
      order.returnShipment?.awb,
      order.deliveryAddress?.fullName,
      order.deliveryAddress?.phone,
      order.deliveryAddress?.city,
      order.deliveryAddress?.pincode,
      order.accountEmail,
      ...order.items.map((i) => i.title),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  };

  const returnRows = useMemo(
    () => rows.filter((r) => r.request.kind === "return" && matchesSearchAndStatus(r)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, statusFilter, q]
  );

  const replacementRows = useMemo(
    () => rows.filter((r) => r.request.kind === "replacement" && matchesSearchAndStatus(r)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, statusFilter, q]
  );

  const runAction = async (orderId: string, fn: () => Promise<string> | string) => {
    setBusyId(orderId);
    setBanner(null);
    try {
      const msg = await fn();
      setBanner({ text: msg });
      setTick((v) => v + 1);
    } catch (e) {
      setBanner({ text: e instanceof Error ? e.message : "Action failed.", err: true });
    } finally {
      setBusyId("");
    }
  };

  const renderRequestCard = ({ order, request }: { order: Order; request: ReturnRequest }) => {
    const fwdShipment = allShipments.find((s) => s.orderId === order.id && s.note !== "Cancelled");
    const back = order.returnShipment;
    const busy = busyId === order.id;
    const courierChoice = courierMap[order.id] || "vgmf-express";
    const rawLastReached = (request.stages || []).map((s) => Boolean(s.reached)).lastIndexOf(true);
    const stageStamps = new Map<string, string>();
    const vpStages: PipelineStageShape[] = (request.stages || []).map((st, idx) => {
      const isReached = Boolean(st.reached) || (rawLastReached >= 0 && idx <= rawLastReached);
      const sid = st.id || `ret-${idx}`;
      if (isReached && (st.at || request.requestedAt)) stageStamps.set(sid, st.at || request.requestedAt);
      return {
        id: sid,
        label: st.title,
        caption: st.detail || st.location || undefined,
        reached: isReached,
        partial: false,
        events: [],
      };
    });
    const curIdx = Math.max(0, vpStages.map((s) => s.reached).lastIndexOf(true));

    return (
      <div key={order.id} className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-4">
        {/* Top Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${request.kind === "replacement" ? "bg-blue-100 text-blue-900" : "bg-purple-100 text-purple-900"}`}>
                {request.kind === "replacement" ? "Replacement Request" : "Return Request (Refund)"}
              </span>
              <span className="font-mono text-sm font-extrabold text-burgundy">#{String(request.id || "").replace(/^RTN/i, "")}</span>
              <span className="text-xs text-text-muted">on</span>
              <Link href={`/admin/commerce/orders?order=${encodeURIComponent(order.id)}`} className="font-mono text-sm font-extrabold text-text-primary underline hover:text-burgundy">
                Order #{order.id}
              </Link>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${request.status === "Rejected" ? "bg-red-100 text-red-800" : ["Replacement Created", "Refunded", "Return Approved", "Accepted"].includes(request.status) ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                {request.status}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Requested {formatDateTime(request.requestedAt)} · Source: <b className="capitalize">{request.source}</b>
              {request.decidedAt ? ` · Decided ${formatDateTime(request.decidedAt)} by ${request.decidedBy || "Admin"}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/commerce/orders?order=${encodeURIComponent(order.id)}`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-text-primary hover:bg-slate-50">
              Open Full Order →
            </Link>
            {request.replacementOrderId && (
              <Link href={`/admin/commerce/orders?order=${encodeURIComponent(request.replacementOrderId)}`} className="rounded-lg bg-burgundy px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
                Replacement Order #{request.replacementOrderId} →
              </Link>
            )}
          </div>
        </div>

        {/* 3-Column Full Order, Request/Evidence, and Live Pipeline Grid */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Column 1: Complete Order & Customer Details */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-2">
            <p className="font-extrabold uppercase tracking-wider text-slate-700">1. Order &amp; Customer Details</p>
            <div className="space-y-1 text-slate-700">
              <p><b>Customer:</b> {order.deliveryAddress?.fullName || "—"}</p>
              <p><b>Phone:</b> {order.deliveryAddress?.phone || "—"}{order.deliveryAddress?.altPhone ? ` / ${order.deliveryAddress.altPhone}` : ""}</p>
              <p><b>Email:</b> {order.accountEmail || order.deliveryAddress?.email || "—"}</p>
              <p><b>Delivery Address:</b> {[order.deliveryAddress?.line1, order.deliveryAddress?.landmark, order.deliveryAddress?.city, order.deliveryAddress?.state, order.deliveryAddress?.pincode].filter(Boolean).join(", ")}</p>
              {request.replacementAddress && (
                <p className="rounded bg-blue-50 p-1.5 text-blue-900">
                  <b>Replacement Address:</b> {[request.replacementAddress.fullName, request.replacementAddress.phone, request.replacementAddress.line1, request.replacementAddress.city, request.replacementAddress.pincode].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <div className="border-t border-slate-200 pt-2 space-y-1 text-slate-700">
              <p><b>Order Date:</b> {formatDateTime(order.date)} · <b>Status:</b> {order.status}</p>
              <p><b>Order Total:</b> {rupees(order.total)} · <b>Payment:</b> {order.paymentStatus} ({order.paymentMethod || "Online"})</p>
              {request.refundAmount !== undefined && <p><b>Refundable Amount:</b> {rupees(request.refundAmount)}</p>}
              <p><b>Forward Courier:</b> {fwdShipment?.courier || order.courierName || "—"} {fwdShipment?.awb || order.trackingId ? `(AWB ${fwdShipment?.awb || order.trackingId})` : ""}</p>
            </div>
            <div className="border-t border-slate-200 pt-2 space-y-1">
              <p className="font-bold text-slate-800">Ordered Items ({order.items.length}):</p>
              {order.items.map((it, idx) => (
                <p key={`${order.id}-it-${idx}`} className="text-slate-700">
                  • {it.quantity} × <b>{it.title}</b> ({rupees(it.price)})
                </p>
              ))}
            </div>
          </div>

          {/* Column 2: Return/Replacement Request, Evidence Photos & Reverse Shipment */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-2.5">
            <p className="font-extrabold uppercase tracking-wider text-slate-700">2. Request, Evidence &amp; Reverse AWB</p>
            <p><b>Reason:</b> <span className="font-semibold text-slate-900">{request.reason}</span></p>
            {request.items?.length ? (
              <div>
                <p className="font-bold text-slate-800">Items in Request:</p>
                {request.items.map((it, idx) => (
                  <p key={`${request.id}-rit-${idx}`}>• {it.quantity} × <b>{it.title}</b> ({rupees(it.price)})</p>
                ))}
              </div>
            ) : null}
            {request.note && <p><b>Customer Note:</b> {request.note}</p>}
            {request.decisionNote && <p><b>Desk Decision Note:</b> {request.decisionNote}</p>}

            {/* Uploaded Evidence Photos */}
            {(request.images?.length || request.evidence) ? (
              <div className="space-y-1.5 border-t border-slate-200 pt-2">
                <p className="font-bold text-slate-800">Customer Evidence Photos:</p>
                <div className="flex flex-wrap gap-2">
                  {(request.images || []).map((src, i) => (
                    <a key={`${request.id}-img-${i}`} href={src} target="_blank" rel="noopener noreferrer" className="group relative block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Evidence ${i + 1}`} className="h-16 w-16 rounded-lg border border-slate-300 object-cover shadow-sm group-hover:opacity-85" />
                    </a>
                  ))}
                </div>
                {request.evidence?.video?.length ? (
                  <video src={request.evidence.video[0]} controls className="mt-1 h-28 rounded-lg border border-slate-300" />
                ) : null}
              </div>
            ) : (
              <p className="text-slate-400 italic">No photos attached.</p>
            )}

            {/* Reverse Pickup Shipment Info */}
            {back?.awb ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 space-y-1 text-emerald-950">
                <p className="font-bold">Reverse Pickup Booked</p>
                <p><b>Courier:</b> {back.courierName} · <b>Return AWB:</b> <span className="font-mono font-bold">{back.awb}</span></p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {back.labelUrl && (
                    <a href={back.labelUrl} target="_blank" rel="noopener noreferrer" className="rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-800">
                      Open / Print Return Label ↗
                    </a>
                  )}
                  {/^(88|89)\d{10}$/.test(back.awb) && (
                    <Link href={`/track-shipment?awb=${encodeURIComponent(back.awb)}`} target="_blank" className="rounded border border-emerald-600 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                      Track on VGMF Logistics ↗
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void runAction(order.id, () => { emailReturnLabel(order.id); return "Return label emailed to customer."; })}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Email Label to Customer
                  </button>
                </div>
              </div>
            ) : null}

            {request.inspection && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 text-blue-950">
                <p className="font-bold">Warehouse QC Inspection: {request.inspection.condition.toUpperCase()}</p>
                <p>Restock: {request.inspection.restock ? "Yes" : "No"} · Checked {formatDateTime(request.inspection.at)}</p>
                {request.inspection.note && <p>Note: {request.inspection.note}</p>}
              </div>
            )}
          </div>

          {/* Column 3: Live Return / Replacement Pipeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs space-y-2">
            <p className="font-extrabold uppercase tracking-wider text-slate-700">3. Live Customer-Facing Pipeline</p>
            {vpStages.length > 0 ? (
              <VerticalPipeline
                stages={vpStages}
                currentIndex={curIdx}
                failed={request.status === "Rejected"}
                metaFor={(s) => {
                  const st = stageStamps.get(s.id);
                  return s.reached && st ? statusStamp(st, order.deliveryAddress?.country) : "";
                }}
              />
            ) : (
              <p className="text-slate-400">No stages recorded.</p>
            )}
          </div>
        </div>

        {/* Bottom Action Console */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">Admin Workflow Actions</p>

          {(request.status === "Pending Review" || request.status === "Return Requested") && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-60 flex-1">
                <TextInput
                  placeholder="Decision note for customer email (optional)..."
                  value={notes[order.id] ?? ""}
                  onChange={(e) => setNotes((m) => ({ ...m, [order.id]: e.target.value }))}
                />
              </div>
              <Button
                variant="success"
                disabled={busy}
                onClick={() => void runAction(order.id, () => {
                  reviewReplacementRequest(order.id, { accept: true, note: notes[order.id], by: "Admin" });
                  return `${request.kind === "replacement" ? "Replacement" : "Return"} request ${request.id} accepted & customer notified.`;
                })}
              >
                Accept Request ✓
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => void runAction(order.id, () => {
                  reviewReplacementRequest(order.id, { accept: false, note: notes[order.id] || "Rejected after reviewing evidence.", by: "Admin" });
                  return `${request.kind === "replacement" ? "Replacement" : "Return"} request ${request.id} rejected.`;
                })}
              >
                Reject Request
              </Button>
            </div>
          )}

          {(request.status === "Return Approved" || request.status === "Accepted") && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Select Return Courier:</span>
              <SelectInput
                className="w-64"
                value={courierChoice}
                onChange={(e) => setCourierMap((m) => ({ ...m, [order.id]: e.target.value as "vgmf-express" | "shiprocket" | "ithink" }))}
              >
                <option value="vgmf-express">VGMF Express (Own Logistics · 12-Digit Return AWB)</option>
                <option value="shiprocket">Shiprocket (Reverse Pickup)</option>
                <option value="ithink">iThink Logistics (Reverse Pickup)</option>
              </SelectInput>
              <Button
                disabled={busy}
                onClick={() => void runAction(order.id, async () => {
                  if (courierChoice === "vgmf-express") {
                    const res = await fetch("/api/admin/hub-ops", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        action: "return-create",
                        code: order.id,
                        kind: "customer_return",
                        reason: request.reason || "Customer return",
                      }),
                    });
                    const j = await res.json();
                    if (!res.ok || !j?.ok || !j?.returnRecord?.returnAwb) {
                      throw new Error(j?.error || "Could not create VGMF Express return AWB.");
                    }
                    const retAwb = String(j.returnRecord.returnAwb);
                    const labelUrl = `https://vaidyagogate.org/api/admin/vgmf-label?awb=${encodeURIComponent(retAwb)}`;
                    patchOrder(order.id, {
                      returnShipment: {
                        provider: "vgmf-express",
                        live: true,
                        awb: retAwb,
                        courierName: "VGMF Express (Return)",
                        createdAt: new Date().toISOString(),
                        note: `VGMF Express Return AWB ${retAwb}`,
                        labelUrl,
                        charge: 0,
                      },
                    }, "VGMF Express return pickup booked");
                    try { emailReturnLabel(order.id); } catch { /* optional */ }
                    if (request.kind === "replacement") {
                      advanceReturnRequest(order.id, "Pickup Scheduled", "return-label", `Return AWB ${retAwb} · VGMF Express. Download the label, paste it on the parcel and hand it to our executive.`);
                    } else {
                      updateReturnRequest(order.id, { status: "Pickup Scheduled" });
                    }
                    return `VGMF Express 12-Digit Return AWB ${retAwb} created & added to Delivery Partner Return Runsheet.`;
                  }
                  const created = await createReturnShipment(order.id, courierChoice);
                  patchOrder(order.id, {
                    returnShipment: {
                      provider: created.provider,
                      live: created.live,
                      awb: created.awb,
                      courierName: created.courierName,
                      createdAt: new Date().toISOString(),
                      note: created.note,
                      labelUrl: created.labelUrl,
                      charge: created.courierCost,
                    },
                  }, "Return pickup booked");
                  try { emailReturnLabel(order.id); } catch { /* optional */ }
                  if (request.kind === "replacement") {
                    advanceReturnRequest(order.id, "Pickup Scheduled", "return-label", `Return AWB ${created.awb} · ${created.courierName}. Download the label, paste it on the parcel and hand it to the courier.`);
                  } else {
                    updateReturnRequest(order.id, { status: "Pickup Scheduled" });
                  }
                  return `Return pickup booked via ${created.courierName} (AWB ${created.awb}).`;
                })}
              >
                Create Return AWB &amp; Label
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  const awb = window.prompt("Enter manual Return AWB / tracking number:")?.trim();
                  if (!awb) return;
                  const courierName = window.prompt("Courier name (e.g. India Post, DTDC):")?.trim() || "Courier";
                  const labelUrl = window.prompt("Return label URL (optional):")?.trim() || undefined;
                  void runAction(order.id, () => {
                    patchOrder(order.id, { returnShipment: { provider: "local", live: false, awb, courierName, createdAt: new Date().toISOString(), labelUrl } }, `Return AWB ${awb} entered`);
                    if (request.kind === "replacement") advanceReturnRequest(order.id, "Pickup Scheduled", "return-label", `Return AWB ${awb} · ${courierName}.`);
                    else updateReturnRequest(order.id, { status: "Pickup Scheduled" });
                    return `Manual Return AWB ${awb} saved.`;
                  });
                }}
              >
                Enter Manual AWB
              </Button>
            </div>
          )}

          {request.status === "Pickup Scheduled" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void runAction(order.id, () => {
                  if (request.kind === "replacement") {
                    advanceReturnRequest(order.id, "Picked Up", "return-pickup", "The courier collected the returned item from the customer.");
                  } else {
                    updateReturnRequest(order.id, { status: "Picked Up" });
                  }
                  return "Marked returned parcel as Picked Up by courier.";
                })}
              >
                Mark Parcel Picked Up ✓
              </Button>
            </div>
          )}

          {(["Picked Up", "Pickup Scheduled", "At Return Hub", "In Transit", "Out for Seller Delivery", "Received by Seller"].includes(request.status)) && !request.inspection && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
              <span className="text-xs font-bold text-slate-700">Warehouse QC Check:</span>
              <div className="min-w-48 flex-1">
                <TextInput
                  placeholder="Inspection note (condition, seal, damage verified)..."
                  value={qcNotes[order.id] ?? ""}
                  onChange={(e) => setQcNotes((m) => ({ ...m, [order.id]: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={qcRestock[order.id] ?? false}
                  onChange={(e) => setQcRestock((m) => ({ ...m, [order.id]: e.target.checked }))}
                />
                Restock Inventory
              </label>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void runAction(order.id, () => {
                  recordReturnInspection(
                    order.id,
                    qcRestock[order.id] ? "Good" : "Damaged",
                    qcNotes[order.id] || "Returned item received and verified.",
                    "Admin"
                  );
                  return "QC inspection recorded (Passed).";
                })}
              >
                Record QC Passed ✓
              </Button>
            </div>
          )}

          {request.kind === "replacement" && request.inspection && !request.replacementOrderId && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
              <Button
                variant="success"
                disabled={busy}
                onClick={() => void runAction(order.id, () => {
                  const updated = sendReplacementAfterInspection(order.id, "Admin");
                  return `Free replacement order #${updated.replacementOrderId} created and queued for dispatch!`;
                })}
              >
                Create &amp; Dispatch Free Replacement Order →
              </Button>
            </div>
          )}

          {request.kind === "return" && request.status !== "Refunded" && request.status !== "Rejected" && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
              <Button
                variant="success"
                disabled={busy}
                onClick={() => void runAction(order.id, () => {
                  updateReturnRequest(order.id, { status: "Refunded" });
                  return `Return ${request.id} marked as Refunded (${rupees(request.refundAmount)}).`;
                })}
              >
                Mark Return Refunded ({rupees(request.refundAmount)}) ✓
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary">
            {sectionView === "return" ? "Returns Desk (All Return Requests)" : sectionView === "replacement" ? "Replacements Desk (All Replacement Requests)" : "Returns & Replacements Desk"}
          </h1>
          <p className="text-xs text-text-muted">
            Dedicated sections for Return Requests (refunds) and Replacement Requests (free replacements) with full order details &amp; reverse pickup AWB creation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/commerce/returns" className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${sectionView === "return" ? "border-purple-700 bg-purple-700 text-white" : "border-border bg-white text-text-primary hover:bg-slate-50"}`}>
            Returns Section ({counts.ret})
          </Link>
          <Link href="/admin/commerce/replacements" className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${sectionView === "replacement" ? "border-blue-700 bg-blue-700 text-white" : "border-border bg-white text-text-primary hover:bg-slate-50"}`}>
            Replacements Section ({counts.replacement})
          </Link>
          <button
            type="button"
            onClick={() => setSectionView("both")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${sectionView === "both" ? "border-burgundy bg-burgundy text-white" : "border-border bg-white text-text-primary hover:bg-slate-50"}`}
          >
            Show Both Sections ({counts.total})
          </button>
          <Link href="/admin/commerce/approvals" className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-text-primary hover:bg-slate-50">
            Approvals Queue ({counts.pending})
          </Link>
        </div>
      </div>

      {banner && (
        <div className={`rounded-xl border px-4 py-3 text-xs font-bold ${banner.err ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {banner.text}
        </div>
      )}

      {/* Search & Status Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-3.5 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {([
            ["all", `All Statuses (${counts.total})`],
            ["pending", `Pending Review (${counts.pending})`],
            ["in_progress", `Pickup / Received / QC (${counts.inProgress})`],
            ["closed", `Completed / Closed (${counts.closed})`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${statusFilter === id ? "bg-burgundy text-white" : "border border-border bg-white text-text-primary hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-80">
          <TextInput
            placeholder="Search Order #, RTN #, Return AWB, Customer, Phone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Admin Quick-Open Return/Replacement Bar */}
      <div className="rounded-xl border border-border bg-white p-3.5 shadow-sm">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-text-muted">Open Return or Replacement on a Delivered Order</p>
        <div className="grid gap-2 sm:grid-cols-5">
          <TextInput placeholder="Delivered Order ID (e.g. 6085...)" value={newOrderId} onChange={(e) => setNewOrderId(e.target.value)} />
          <SelectInput value={newKind} onChange={(e) => setNewKind(e.target.value as "replacement" | "return")}>
            <option value="return">Return Request (Refund)</option>
            <option value="replacement">Replacement Request (Free Copy)</option>
          </SelectInput>
          <TextInput className="sm:col-span-2" placeholder="Reason (e.g. Product damaged / Wrong book)" value={newReason} onChange={(e) => setNewReason(e.target.value)} />
          <Button
            onClick={() => {
              const target = allOrders.find((o) => o.id === newOrderId.trim());
              if (!target) {
                setBanner({ text: `Order "${newOrderId.trim()}" not found.`, err: true });
                return;
              }
              void runAction(target.id, () => {
                const req = initiateReturn(target, { kind: newKind, reason: newReason.trim() || "Damaged or defective item", source: "admin" });
                setNewOrderId("");
                return `Opened ${newKind} request ${req.id} on Order #${target.id}.`;
              });
            }}
          >
            Open Request
          </Button>
        </div>
      </div>

      {/* SECTION 1: RETURNS (ALL RETURN REQUESTS) */}
      {(sectionView === "both" || sectionView === "return") && (
        <section className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/70 px-4 py-3">
            <div>
              <h2 className="text-base font-extrabold text-purple-950">Returns — All Return Requests ({returnRows.length})</h2>
              <p className="text-xs text-purple-900/80">Customer return-for-refund requests, reverse pickup AWB labels, warehouse QC &amp; refund processing.</p>
            </div>
            <span className="rounded-full bg-purple-200 px-3 py-1 text-xs font-extrabold text-purple-950">{returnRows.length} Return{returnRows.length === 1 ? "" : "s"}</span>
          </div>
          {returnRows.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-text-muted">
              No return requests under this filter.
            </div>
          ) : (
            <div className="space-y-4">{returnRows.map(renderRequestCard)}</div>
          )}
        </section>
      )}

      {/* SECTION 2: REPLACEMENTS (ALL REPLACEMENT REQUESTS) */}
      {(sectionView === "both" || sectionView === "replacement") && (
        <section className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3">
            <div>
              <h2 className="text-base font-extrabold text-blue-950">Replacements — All Replacement Requests ({replacementRows.length})</h2>
              <p className="text-xs text-blue-900/80">Customer free-replacement requests, defective item reverse pickup AWB labels, warehouse QC &amp; replacement order dispatch.</p>
            </div>
            <span className="rounded-full bg-blue-200 px-3 py-1 text-xs font-extrabold text-blue-950">{replacementRows.length} Replacement{replacementRows.length === 1 ? "" : "s"}</span>
          </div>
          {replacementRows.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-text-muted">
              No replacement requests under this filter.
            </div>
          ) : (
            <div className="space-y-4">{replacementRows.map(renderRequestCard)}</div>
          )}
        </section>
      )}
    </div>
  );
}
