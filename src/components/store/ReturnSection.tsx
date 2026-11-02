"use client";

import { useState } from "react";
import Link from "next/link";
import { classNames } from "@/lib/utils";
import { getOrders, getReturnRequest, requestDamagedReplacement } from "@/lib/store";
import { canCustomerRequestReplacement, customerOrderPolicyCopy } from "@/lib/integrations";
import { useOrderSettings } from "@/lib/use-cms";
import { fileToDataUrl } from "@/lib/images";
import type { Order, ReturnRequest } from "@/types";

export default function ReturnSection({ order }: { order: Order }) {
  const settings = useOrderSettings();
  const windowDays = order.returnableDays || settings.returns.windowDays;
  const policy = customerOrderPolicyCopy();
  const [, setTick] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const request = getReturnRequest(order.id) ?? order.returnRequest;
  const canRequest = canCustomerRequestReplacement({ ...order, returnRequest: request }, settings);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const next = [...images];
    for (const file of Array.from(files).slice(0, 6 - next.length)) {
      if (!file.type.startsWith("image/")) continue;
      next.push(await fileToDataUrl(file, 1400, 0.78));
    }
    setImages(next.slice(0, 6));
  };

  const handleSubmit = () => {
    if (images.length === 0) {
      setError("Share at least one photo of the damage.");
      return;
    }
    setBusy(true);
    try {
      requestDamagedReplacement(order, {
        reason: "Damaged or defective item",
        images,
        note,
      });
      setShowForm(false);
      setTick((value) => value + 1);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-5 text-xs text-text-muted">
      <p className="font-semibold text-text-primary">Replacement for damaged items</p>

      {request ? (
        <ReplacementStatus request={request} />
      ) : canRequest ? (
        <>
          {!showForm ? (
            <div className="mt-3 space-y-3">
              <p>
                If this item arrived damaged, request a replacement. Photos are required. The Foundation desk reviews the request and, if accepted, places a new free order.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white transition hover:bg-burgundy-dark"
                >
                  Request replacement
                </button>
                <Link
                  href="/contact"
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-burgundy transition hover:bg-warm-cream"
                >
                  Contact support
                </Link>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
              className="mt-4 space-y-4"
            >
              <p className="text-text-primary">
                Damaged item only. Upload clear photos of the package and the damaged product. Returns and cancellations are not available from your account.
              </p>
              <label className="block">
                <span className="mb-1.5 block font-semibold text-text-primary">Photos of the damage</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={(event) => void addPhotos(event.target.files)}
                  className="block w-full text-xs"
                />
              </label>
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((src, index) => (
                    <button
                      key={src.slice(0, 24) + index}
                      type="button"
                      onClick={() => setImages(images.filter((_, i) => i !== index))}
                      className="relative h-16 w-16 overflow-hidden rounded-lg border border-border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Damage ${index + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <label className="block">
                <span className="mb-1.5 block font-semibold text-text-primary">What is damaged? (optional)</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="input-field"
                  placeholder="Describe the damage so the desk can review it faster."
                />
              </label>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy} className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white transition hover:bg-burgundy-dark disabled:opacity-60">
                  {busy ? "Sending…" : "Submit replacement request"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-burgundy transition hover:bg-warm-cream"
                >
                  Close
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <p className="mt-2">
          {order.status === "Delivered"
            ? `The ${windowDays}-day replacement window for damaged items has closed.`
            : "If an item arrives damaged, you can request a replacement with photos after delivery."}
        </p>
      )}

      <div className="mt-4 rounded-xl bg-warm-cream/60 p-3">
        <p className="font-semibold text-text-primary">{policy.title}</p>
        <p className="mt-1">{policy.body}</p>
      </div>
    </div>
  );
}

const FULFILLMENT = ["Pending", "Paid", "Processing", "Ordered", "Accepted", "Packed", "Ready to Ship", "To Ship", "Shipped", "Out for Delivery", "Delivered"];

function statusRank(status?: string) {
  const index = FULFILLMENT.indexOf(status || "");
  return index < 0 ? -1 : index;
}

function whenLabel(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ReplacementStatus({ request }: { request: ReturnRequest }) {
  const tone =
    request.status === "Rejected"
      ? "bg-red-50 text-red-700"
      : request.status === "Replacement Created" || request.status === "Accepted"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-burgundy/10 text-burgundy";
  const replacement = request.replacementOrderId ? getOrders().find((order) => order.id === request.replacementOrderId) : undefined;
  const rank = statusRank(replacement?.status);
  const stampFor = (names: string[]) =>
    replacement?.history?.find((entry) => names.includes(entry.status))?.at
    || request.stages.find((stage) => stage.reached && stage.at && names.includes(stage.title))?.at
    || "";
  const steps = [
    { id: "requested", title: "Request received", reached: true, at: request.requestedAt, detail: "Photos and the damage note are with the desk." },
    { id: "review", title: "Desk review", reached: true, at: request.requestedAt, detail: "The Foundation desk checks the photos." },
    {
      id: "decision",
      title: request.status === "Rejected" ? "Request rejected" : "Decision",
      reached: request.status !== "Pending Review",
      at: request.decidedAt,
      detail: request.decisionNote || (request.status === "Pending Review" ? "Waiting for accept or reject." : "Accepted."),
    },
    ...(request.status === "Rejected"
      ? []
      : [
          { id: "placed", title: "Free replacement order", reached: Boolean(replacement), at: request.decidedAt, detail: replacement ? `Order ${replacement.id}` : "Placed when the request is accepted." },
          { id: "packed", title: "Packed", reached: rank >= statusRank("Packed"), at: stampFor(["Packed", "Ready to Ship", "To Ship"]), detail: "The replacement is packed for dispatch." },
          { id: "shipped", title: "Shipped", reached: rank >= statusRank("Shipped"), at: stampFor(["Shipped"]), detail: replacement?.trackingId ? `Tracking ${replacement.trackingId}` : "Handed to the courier." },
          { id: "out", title: "Out for delivery", reached: rank >= statusRank("Out for Delivery"), at: stampFor(["Out for Delivery"]), detail: "On the way to you." },
          { id: "delivered", title: "Delivered", reached: rank >= statusRank("Delivered"), at: stampFor(["Delivered"]), detail: "The replacement has been delivered." },
        ]),
  ];

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl bg-warm-cream/60 p-3">
        <p className="font-semibold text-text-primary">
          Replacement request <span className="font-mono text-burgundy">{request.id}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={classNames("rounded-full px-2.5 py-0.5 text-[11px] font-bold", tone)}>{request.status}</span>
          <span>Requested {whenLabel(request.requestedAt)} IST</span>
        </div>
        {request.reason && (
          <p className="mt-2">
            Reason: <span className="font-medium text-text-primary">{request.reason}</span>
          </p>
        )}
        {request.note && <p className="mt-1">{request.note}</p>}
        {request.images?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {request.images.map((src, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${request.id}-${index}`} src={src} alt={`Damage photo ${index + 1}`} className="h-16 w-16 rounded-lg object-cover" />
            ))}
          </div>
        ) : null}
      </div>

      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.id} className="flex gap-3">
            <span className={classNames("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", step.reached ? "bg-burgundy" : "bg-border")} />
            <span>
              <span className={classNames("block text-sm font-semibold", step.reached ? "text-ink" : "text-text-muted")}>{step.title}</span>
              {step.detail && <span className="mt-0.5 block">{step.detail}</span>}
              {step.reached && step.at && <span className="mt-0.5 block">{whenLabel(step.at)} IST</span>}
            </span>
          </li>
        ))}
      </ol>

      {replacement && (
        <p>
          <Link href={`/account/orders#${replacement.id}`} className="font-semibold text-burgundy">
            Open replacement order {replacement.id}
          </Link>
        </p>
      )}
    </div>
  );
}
