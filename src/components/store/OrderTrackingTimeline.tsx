"use client";

import { getPickupLocation } from "@/lib/fulfillment";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDate } from "@/lib/utils";
import { agreedDelivery, deliveryDatePhrase, parseExpected, statusStamp } from "@/lib/delivery-expectation";
import { storeConfig } from "@/lib/constants";
import { getShipments } from "@/lib/admin-store";
import { pickupOtp, pickupOtpReady } from "@/lib/store";
import { rememberOrder, rememberShipment } from "@/lib/commerce-sync";
import { customerCourierLabel } from "@/lib/courier-label";
import { getIntegrations } from "@/lib/integrations";
import { useOrderSettings } from "@/lib/use-cms";
import { buildTrackingStages, cleanScanText, isHyperlocalProvider, shipmentScans, type CourierScan } from "@/lib/order-pipeline";
import { pingLiveAgent } from "@/lib/shipping-client";
import VerticalPipeline, { type PipelineStageShape, type PipelineTone } from "@/components/tracking/VerticalPipeline";
import LiveTracking from "@/components/store/LiveTracking";
import HyperlocalStatus from "@/components/store/HyperlocalStatus";
import RefundDetails, { REFUND_CREDIT_NOTE } from "@/components/store/RefundDetails";
import { beep } from "@/lib/scan-beep";
import type { Order, ShipmentRecord } from "@/types";

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

const sameCity = (place: string, city: string) => {
  const a = place.toLowerCase().replace(/[^a-z]/g, "");
  const b = city.toLowerCase().replace(/[^a-z]/g, "");
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
};

/**
 * Couriers usually move a parcel: seller area hub → seller city hub → buyer city hub → buyer local hub → delivery.
 * Returns how far along that route the latest scan is, so the line between Shipped and Out for delivery moves forward.
 */
function courierHubShare(events: { title?: string; location?: string }[], fromCity: string, toCity: string) {
  let share = 0;
  const local = sameCity(fromCity, toCity);
  for (const event of events) {
    const text = `${event.title ?? ""} ${event.location ?? ""}`.toLowerCase();
    const where = `${event.location ?? ""} ${event.title ?? ""}`;
    const atBuyer = toCity && sameCity(where, toCity);
    const atSeller = fromCity && sameCity(where, fromCity);
    let step = 0;
    if (/picked up|pickup done|pickup complete|manifested|shipment picked/.test(text)) step = 0.12;
    if (/arrived|received|reached|inward|bag(ged)?|hub|facility|sort/.test(text)) step = Math.max(step, local ? 0.35 : atSeller ? 0.25 : 0.45);
    if (/left|depart|dispatch|in transit|forwarded|connected|en route|outscan/.test(text)) step = Math.max(step, local ? 0.5 : atBuyer ? 0.72 : 0.45);
    if (atBuyer && !local && /arrived|received|reached|inward|hub|facility/.test(text)) step = Math.max(step, 0.65);
    if (/delivery (centre|center|hub)|\bdc\b|last mile|local hub|destination (hub|city)|reached at destination|at destination/.test(text)) step = Math.max(step, 0.82);
    share = Math.max(share, step);
  }
  return share;
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="vgmf-trk-tile">
      <b>{label}</b>
      <span>{value}</span>
    </div>
  );
}

export default function OrderTrackingTimeline({ order, phone = "", shipmentId = "", detailed = false }: { order: Order; phone?: string; shipmentId?: string; detailed?: boolean }) {
  const orderSettings = useOrderSettings();
  useEffect(() => {
    if (order.status !== "Delivered") return;
    const key = `vgmf_delivered_beep_${order.id}`;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
    beep("delivered");
  }, [order.id, order.status]);
  const [pickupAt] = useState(() => getPickupLocation());
  const [now] = useState(() => Date.now());
  const ownShipment = (item: ShipmentRecord) => item.orderId === order.id && (shipmentId ? item.id === shipmentId : item.note !== "Cancelled");
  const localShipment = getShipments().find(ownShipment) ?? null;
  const [remote, setRemote] = useState<ShipmentRecord | null>(null);
  const shipment = remote ?? localShipment;
  const provider = shipment?.provider ?? order.courierChoice?.provider;
  const isVgmfExpress = /vgmf express/i.test(shipment?.courier || order.courierName || "") || /^8[89]\d{10}$/.test(String(shipment?.awb || order.trackingId || ""));
  const hyperlocal = !isVgmfExpress && isHyperlocalProvider(provider, order.courierChoice?.lastMile, shipment?.courier || order.courierName);
  const [scans, setScans] = useState<CourierScan[]>(() => shipmentScans(shipment));
  const preorder = Boolean(order.preorderPayment) || order.items.some((item) => item.preorder);
  const courierBooked = Boolean(shipment && shipment.note !== "Cancelled" && (shipment.awb || shipment.courier));
  // Hidden dates (or a pre-order with dates off) only show once a courier is booked, and then only the courier's own date.
  const hideDates = orderSettings.hideDeliveryDates || (preorder && !orderSettings.showPreorderStepDates);
  const orderAround = Date.parse(order.date) || now;
  const validCourierExpected = shipment?.expectedBy && parseExpected(shipment.expectedBy, orderAround) != null ? shipment.expectedBy : "";
  const rawExpectedText = validCourierExpected || (hideDates
    ? courierBooked ? agreedDelivery(order.eta, validCourierExpected, orderAround) : ""
    : agreedDelivery(order.eta, validCourierExpected, orderAround));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const response = await fetch("/api/shop/shipments", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "refresh", orderId: order.id, shipmentId, phone }),
        });
        const data = (await response.json()) as {
          ok?: boolean;
          live?: boolean;
          shipment?: ShipmentRecord;
          order?: Order;
        };
        if (cancelled) return;
        if (data.shipment) {
          setRemote(data.shipment);
          rememberShipment(data.shipment);
          setScans(shipmentScans(data.shipment));
        }
        if (data.order) rememberOrder(data.order);
        if (data.live) return;
      } catch {
        /* try the courier keys saved on this browser */
      }
      const local = getShipments().find(ownShipment);
      if (!local?.id || cancelled) return;
      try {
        const result = await pingLiveAgent(local.id);
        if (cancelled) return;
        const updated = getShipments().find((item) => item.id === local.id) ?? local;
        setRemote(updated);
        setScans(shipmentScans(updated, result.events ?? []));
      } catch {
        if (!cancelled) setScans(shipmentScans(local));
      }
    };
    void run();
    const terminal = order.status === "Delivered" || order.status === "Cancelled" || order.status === "Failed";
    // Hyperlocal: the rider moves on the map every second, without reloading the page.
    const ping = 1;
    const refundOpen = order.refunds?.some((refund) => refund.gatewayRefundId && refund.status !== "processed" && refund.status !== "failed");
    const ms = refundOpen ? 60_000 : terminal ? 120_000 : hyperlocal ? ping * 1000 : 45_000;
    const timer = window.setInterval(run, ms);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, order.status, phone, hyperlocal, shipmentId, order.refunds?.map((refund) => refund.status).join()]);

  const delivered = order.status === "Delivered";
  const shownScans = scans.map((scan, index, list) =>
    // Hyperlocal: the rider card (with Call) shows the agent, not the timeline.
    !hyperlocal && !delivered && index === list.length - 1 && (shipment?.agentName || shipment?.agentPhone)
      ? { ...scan, agent: { name: shipment.agentName, phone: shipment.agentPhone }, otp: shipment.deliveryOtp || scan.otp }
      : scan
  );
  const { stages: rawStages } = useMemo(() => buildTrackingStages(order, shownScans, shipment, detailed), [order, shownScans, shipment, detailed]);
  const returnRequest = order.returnRequest;
  const courier = customerCourierLabel({ provider, courier: shipment?.courier || order.courierName });
  const trackingId = shipment?.awb || order.trackingId || "";
  const placed = new Date(order.date);
  const packedStage = rawStages.find((stage) => stage.id === "packed");
  const shippedStage = rawStages.find((stage) => stage.id === "shipped");
  const deliveredStage = rawStages.find((stage) => stage.id === "delivered" || stage.id === "picked");
  const dispatchedAt = packedStage?.events[packedStage.events.length - 1]?.at;
  const shippedAt = shippedStage?.events[0]?.at;
  const deliveredAt = deliveredStage?.events[deliveredStage.events.length - 1]?.at;
  const failed = order.status === "Failed" || rawStages.some((stage) => stage.id === "failed" && stage.reached);
  const partialIdx = rawStages.map((stage) => stage.partial).lastIndexOf(true);
  const lastReachedIdx = rawStages.map((stage) => stage.reached).lastIndexOf(true);
  const nodeCurrentIdx = partialIdx !== -1 ? partialIdx : lastReachedIdx;
  const pickupDone = hyperlocal
    ? rawStages.some((stage) => stage.id === "out" && stage.reached)
    : Boolean(shippedStage?.reached);
  // Only display the delivery date after the order has been picked up by the courier partner.
  const expectedText = pickupDone ? rawExpectedText : "";
  const promisedOn = parseExpected(expectedText, placed.getTime());
  const expectedFrom = promisedOn ? new Date(promisedOn - 24 * 60 * 60 * 1000) : addDays(placed, storeConfig.orderPreparationDays + 2);

  const stages: PipelineStageShape[] = rawStages.map((stage) => {
    const next: PipelineStageShape = { ...stage };
    if (stage.id === "shipped" && (trackingId || courier) && stage.reached) {
      next.courierNote = {
        title: `Shipped with ${courier || "the courier"}`,
        detail: [trackingId ? `Tracking id: ${trackingId}` : "", hyperlocal ? "Hyperlocal" : ""].filter(Boolean).join(" · "),
      };
    }
    if (!hyperlocal && stage.id === "out" && stage.reached && order.status !== "Delivered" && (shipment?.agentPhone || shipment?.agentName || shipment?.deliveryOtp)) {
      next.courierNote = {
        title: shipment.agentName ? `Delivery agent: ${shipment.agentName}` : "Delivery agent",
        detail: [shipment.agentPhone ? `Phone ${shipment.agentPhone}` : "", shipment.deliveryOtp ? `Delivery PIN ${shipment.deliveryOtp}` : ""].filter(Boolean).join(" · ") || "Contact shared by the courier",
      };
    }
    const promised = parseExpected(expectedText, placed.getTime());
    // Never show a packing date on or after the delivery date.
    if (stage.id === "packed" && !stage.reached && !hideDates && (!promised || expectedFrom.getTime() < promised - 12 * 60 * 60 * 1000)) {
      next.expected = `Packing expected by ${formatDate(expectedFrom)}`;
    }
    const alreadyDelivered = order.status === "Delivered" || shipment?.status === "Delivered" || stage.reached;
    if (stage.id === "delivered" && !alreadyDelivered) {
      next.expected = pickupDone && expectedText
        ? `Expected by ${deliveryDatePhrase(expectedText)}`
        : !pickupDone
          ? "Delivery date displayed after pickup by courier partner"
          : hideDates
            ? undefined
            : "Expected delivery date is pending from the courier";
    }
    if (stage.id === "ready" && stage.reached) next.caption = order.status === "Delivered" ? "OTP verified" : `Pickup OTP: ${pickupOtp(order.id)}`;
    return next;
  });

  const stageTiming = (stage: PipelineStageShape): { label: string; tone: PipelineTone } | null => {
    if (stage.id === "failed") return { label: "Failed", tone: "red" };
    return null;
  };

  const stageDateLine = (stage: PipelineStageShape): string => {
    switch (stage.id) {
      case "ordered":
        return statusStamp(order.date, order.deliveryAddress?.country);
      case "packed":
        return stage.reached && dispatchedAt ? statusStamp(dispatchedAt, order.deliveryAddress?.country) : "";
      case "shipped":
        return stage.reached && shippedAt ? statusStamp(shippedAt, order.deliveryAddress?.country) : "";
      case "out":
        return stage.reached ? statusStamp(stage.events.at(-1)?.at, order.deliveryAddress?.country) || "Out for delivery" : "";
      case "delivered":
        return stage.reached && deliveredAt ? statusStamp(deliveredAt, order.deliveryAddress?.country) : "";
      case "ready":
        return stage.reached ? (order.status === "Delivered" ? "OTP verified" : `OTP ${pickupOtp(order.id)}`) : "";
      case "picked":
        return stage.reached && deliveredAt ? statusStamp(deliveredAt, order.deliveryAddress?.country) : "";
      case "cancelled":
        return statusStamp(order.history?.find((item) => /cancel/i.test(item.status))?.at || order.date, order.deliveryAddress?.country);
      case "refunded":
        return order.refundAmount ? `₹${order.refundAmount.toLocaleString("en-IN")}` : "";
      case "failed":
        return "Delivery failed";
      default:
        return "";
    }
  };

  const lineNote =
    order.status === "Cancelled"
      ? (order.refunds ?? []).some((refund) => refund.destination !== "store_credit" && refund.status !== "failed")
        ? REFUND_CREDIT_NOTE
        : ""
      : failed
        ? "The line stays on Failed until a reattempt is booked."
        : order.status === "Delivered"
          ? ""
          : order.status === "Out for Delivery"
            ? ""
            : order.deliveryMode === "store_pickup"
              ? "Pickup orders do not go through the courier."
              : hyperlocal
                ? ""
                : "";

  const stepStamp = Date.parse(rawStages[nodeCurrentIdx]?.events.at(-1)?.at || order.date);
  const paceFrom = Number.isFinite(stepStamp) ? stepStamp : placed.getTime();
  const promisedAt = parseExpected(expectedText, paceFrom);
  const paceUntil = promisedAt && promisedAt > paceFrom + 60_000 ? promisedAt : paceFrom + (hyperlocal ? 8 : 72) * 60 * 60 * 1000;
  const latestTitle = rawStages[nodeCurrentIdx]?.events.at(-1)?.title ?? "";
  const facilityStatus = /^(Pickup scheduled|Shipment arrived at courier facility|Shipment left courier facility)/.test(latestTitle);
  const currentStatus = facilityStatus ? cleanScanText(latestTitle) : rawStages[nodeCurrentIdx]?.label || order.status;

  const hubShare = courierHubShare(
    rawStages.find((stage) => stage.id === "shipped" && stage.reached && !rawStages.some((later) => later.id === "out" && later.reached))?.events ?? [],
    getIntegrations().shipping.pickup?.city || "",
    order.deliveryAddress?.city || ""
  );

  const pipe = (
    <VerticalPipeline
      stages={stages}
      currentIndex={nodeCurrentIdx}
      failed={failed}
      metaFor={stageDateLine}
      timingFor={stageTiming}
      note={lineNote}
      country={order.deliveryAddress?.country}
      pace={failed || order.status === "Delivered" ? null : { from: paceFrom, until: paceUntil }}
      hubShare={hyperlocal ? 0 : hubShare}
    />
  );

  const tiles = (
    <div className="vgmf-trk-tiles">
      <Tile label="Order" value={order.id} />
      <Tile label="Date" value={formatDate(order.date)} />
      <Tile label="Status" value={currentStatus} />
      {pickupDone ? <Tile label="Courier" value={courier} /> : null}
      {pickupDone && !delivered && shipment?.agentPhone ? <Tile label="Rider" value={[shipment.agentName, shipment.agentPhone].filter(Boolean).join(" · ")} /> : null}
      {((shipment?.deliveryOtp && !delivered && (currentStatus === "Out for Delivery" || shipment?.status === "Out for Delivery" || order.status === "Out for Delivery")) || shipment?.deliveryOtpVerified) ? (
        <Tile
          label="Delivery OTP"
          value={
            <>
              {!delivered && shipment?.deliveryOtp ? <span className="mr-2">{shipment.deliveryOtp}</span> : null}
              {shipment?.deliveryOtpVerified ? <span className="font-semibold text-emerald-700">✓ Verified</span> : null}
            </>
          }
        />
      ) : null}
      {pickupOtpReady(order) && order.status !== "Delivered" ? <Tile label="Pickup OTP" value={pickupOtp(order.id)} /> : null}
      {order.deliveryMode === "store_pickup" && order.status !== "Delivered" && order.status !== "Cancelled" ? (
        <>
          <Tile label="Pickup at" value={`${pickupAt.name}, ${pickupAt.address}`} />
          <Tile label="Point of contact" value={[pickupAt.contactName, pickupAt.contactPhone].filter(Boolean).join(" · ")} />
          <Tile label="Pickup timings" value={pickupAt.hours} />
          {order.eta && (pickupOtpReady(order) || (preorder ? orderSettings.pickupDates.preorder : orderSettings.pickupDates.inStock)) ? (
            <Tile
              label={pickupOtpReady(order) ? "Ready for pickup" : "Ready by"}
              value={`${order.eta}${order.pickupHoldUntil ? ` · held until ${order.pickupHoldUntil}` : ""}`}
            />
          ) : null}
          <div className="vgmf-trk-tile">
            <b>Location</b>
            <a href={pickupAt.mapUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-burgundy underline">Open in Google Maps</a>
          </div>
        </>
      ) : null}
    </div>
  );

  const returnBack = order.returnShipment;
  const returnRejected = returnRequest?.status === "Rejected";
  const rawReturnLastReached = returnRequest ? returnRequest.stages.map((s) => Boolean(s.reached)).lastIndexOf(true) : -1;
  const returnStageTimestamps = new Map<string, string>();
  const returnStages: PipelineStageShape[] = returnRequest
    ? returnRequest.stages.map((st, idx) => {
        const isReached = Boolean(st.reached) || (rawReturnLastReached >= 0 && idx <= rawReturnLastReached);
        const stageId = st.id || `ret-${idx}`;
        if (isReached && (st.at || returnRequest.requestedAt)) {
          returnStageTimestamps.set(stageId, st.at || returnRequest.requestedAt);
        }
        const isPickupStage = /pickup|courier|transit|shipped|picked/i.test(st.title || st.id);
        const isReplacementStage = /replacement/i.test(st.title || st.id) && !/requested/i.test(st.title || st.id);
        const stageObj: PipelineStageShape = {
          id: stageId,
          label: st.title,
          caption: st.detail || st.location || undefined,
          reached: isReached,
          partial: false,
          events: [],
        };
        if (isPickupStage && returnBack?.awb && st.reached) {
          stageObj.courierNote = {
            title: `Return via ${returnBack.courierName || "VGMF Express"}`,
            detail: `Return AWB: ${returnBack.awb}`,
          };
        }
        if (isReplacementStage && returnRequest.replacementOrderId && st.reached) {
          stageObj.courierNote = {
            title: `Replacement Order #${returnRequest.replacementOrderId}`,
            detail: "Free replacement created & queued for dispatch",
          };
        }
        return stageObj;
      })
    : [];
  const returnCurrentIdx = Math.max(0, returnStages.map((s) => s.reached).lastIndexOf(true));
  const returnPipeline = returnRequest && returnStages.length
    ? {
        stages: returnStages,
        currentIndex: returnCurrentIdx,
        failed: Boolean(returnRejected),
        metaFor: (stage: PipelineStageShape) => {
          const stamp = returnStageTimestamps.get(stage.id);
          return stage.reached && stamp ? statusStamp(stamp, order.deliveryAddress?.country) : "";
        },
        timingFor: (stage: PipelineStageShape): { label: string; tone: PipelineTone } | null => {
          if (returnRejected && stage.id === returnStages[returnCurrentIdx]?.id) {
            return { label: "Rejected", tone: "red" };
          }
          if (stage.reached && stage.id === returnStages[returnStages.length - 1]?.id) {
            return { label: "Completed", tone: "emerald" };
          }
          if (stage.reached && stage.id === returnStages[returnCurrentIdx]?.id) {
            return { label: returnRequest.status, tone: "emerald" };
          }
          return null;
        },
      }
    : null;

  const returnActive = Boolean(returnPipeline && returnRequest && returnRequest.status !== "Rejected");

  return (
    <div className="vgmf-trk">
      {tiles}
      {preorder && orderSettings.preorderPayment?.disclaimerEnabled !== false && order.status !== "Delivered" && order.status !== "Cancelled" ? (
        <div className="my-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-950">
          {orderSettings.preorderPayment?.disclaimerText || "Pre-Order Notice: Shipping and delivery for pre-order items will begin by the end of December."}
        </div>
      ) : null}
      {pickupDone && expectedText && order.deliveryMode === "delivery" && !["Delivered", "Cancelled"].includes(order.status) && shipment?.status !== "Delivered" ? (
        <p className="vgmf-trk-note">
          <b>Expected delivery by</b> {deliveryDatePhrase(expectedText)}
        </p>
      ) : null}
      {(() => {
        // Tracking is public: no amounts, only whether it is paid (or a link to pay what is due).
        if (order.status === "Cancelled") return null;
        const plan = order.preorderPayment;
        const link = plan && !plan.balancePaidAt ? plan.link : order.paymentStatus !== "Paid" ? order.paymentLink : undefined;
        const paid = order.paymentStatus === "Paid" && (!plan || Boolean(plan.balancePaidAt) || !plan.balance);
        if (paid) return <p className="vgmf-trk-note font-bold" style={{ color: "#15803d" }}><span aria-hidden="true">✔</span> Paid</p>;
        return link ? (
          <p className="vgmf-trk-note font-bold">
            Payment due ·{" "}
            <a href={link.url} className="font-semibold text-burgundy underline">click here to pay</a>
          </p>
        ) : null;
      })()}
      <RefundDetails order={order} />
      {returnActive && returnRequest && returnPipeline ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                  {returnRequest.kind === "replacement" ? "Replacement Tracking" : "Return Tracking"} · #{String(returnRequest.id || "").replace(/^RTN/i, "")}
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {returnRequest.reason || (returnRequest.kind === "replacement" ? "Free Replacement" : "Return & Refund")}
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
                {returnRequest.status}
              </span>
            </div>
            {(returnBack?.awb || returnRequest.replacementOrderId) ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {returnBack?.awb ? (
                  <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono font-semibold text-slate-800">
                    Return AWB: {returnBack.awb}
                  </span>
                ) : null}
                {returnBack?.awb && /^(88|89)\d{10}$/.test(returnBack.awb) ? (
                  <Link href={`/track-shipment?awb=${encodeURIComponent(returnBack.awb)}`} style={{ color: "#ffffff" }} className="rounded-lg bg-emerald-700 px-3 py-1 font-bold text-white hover:bg-emerald-800">
                    Track Reverse AWB →
                  </Link>
                ) : null}
                {returnRequest.replacementOrderId ? (
                  <Link href={`/account/orders/${encodeURIComponent(returnRequest.replacementOrderId)}`} style={{ color: "#ffffff" }} className="rounded-lg bg-burgundy px-3 py-1 font-bold text-white hover:opacity-90">
                    Track Replacement Order #{returnRequest.replacementOrderId} →
                  </Link>
                ) : null}
              </div>
            ) : null}
            <VerticalPipeline
              stages={returnPipeline.stages}
              currentIndex={returnPipeline.currentIndex}
              failed={returnPipeline.failed}
              metaFor={returnPipeline.metaFor}
              timingFor={returnPipeline.timingFor}
              country={order.deliveryAddress?.country}
            />
          </div>
          <details className="rounded-xl border border-slate-200 bg-white/70 p-3">
            <summary className="cursor-pointer text-xs font-bold text-slate-600">
              View Original Delivery Timeline
            </summary>
            <div className="mt-3">{pipe}</div>
          </details>
        </div>
      ) : showLiveMap(order, shipment) ? (
        <div className="vgmf-hl">
          <div className="vgmf-hl-sheet">
            <HyperlocalStatus order={order} shipment={shipment} riderOnly />
            <div className="mt-4">{pipe}</div>
          </div>
          <div className="vgmf-hl-map">
            <LiveTracking order={order} shipment={shipment} />
          </div>
        </div>
      ) : (
        pipe
      )}

      {returnPipeline && returnRequest && !returnActive ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/40 p-4 space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-wider text-red-700">
            {returnRequest.kind === "replacement" ? "Replacement Request" : "Return Request"} · {returnRequest.status}
          </p>
          <VerticalPipeline
            stages={returnPipeline.stages}
            currentIndex={returnPipeline.currentIndex}
            failed={returnPipeline.failed}
            metaFor={returnPipeline.metaFor}
            timingFor={returnPipeline.timingFor}
            country={order.deliveryAddress?.country}
          />
        </div>
      ) : null}
    </div>
  );
}

/** The rider map is only for hyperlocal deliveries, and only once a rider has been booked. */
function showLiveMap(order: Order, shipment?: ShipmentRecord | null) {
  if (order.deliveryMode !== "delivery" || !shipment) return false;
  if (["Delivered", "Cancelled", "Failed"].includes(order.status)) return false;
  if (shipment.directCourier) return false;
  return isHyperlocalProvider(shipment.provider ?? order.courierChoice?.provider, order.courierChoice?.lastMile, shipment.courier || order.courierName);
}
