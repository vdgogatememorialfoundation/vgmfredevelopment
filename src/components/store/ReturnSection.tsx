"use client";

import { useState } from "react";
import Link from "next/link";
import { classNames } from "@/lib/utils";
import { initiateReturn, getReturnRequest } from "@/lib/store";
import { cancelOrder } from "@/lib/admin-store";
import { canCustomerCancel } from "@/lib/integrations";
import { useOrderSettings } from "@/lib/use-cms";
import type { Order, ReturnKind, ReturnRequest } from "@/types";

export default function ReturnSection({ order }: { order: Order }) {
  const settings = useOrderSettings();
  const RETURN_REASONS = settings.returns.reasons.length ? settings.returns.reasons : ["Other"];
  const windowDays = order.returnableDays || settings.returns.windowDays;
  const [now] = useState(() => Date.now());
  const [, setReturnTick] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<ReturnKind>("return");
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [error, setError] = useState("");

  const request = getReturnRequest(order.id) ?? order.returnRequest;

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError("Please pick a reason.");
      return;
    }
    initiateReturn(order, { kind, reason });
    setReturnTick((value) => value + 1);
    setShowForm(false);
  };

  const policyBullets = (
    <ul className="mt-2 list-inside list-disc space-y-1.5">
      <li>
        {settings.cancellation.enabled
          ? `Cancellable until the order is ${settings.cancellation.allowedUntil.toLowerCase()}${settings.cancellation.windowHours > 0 ? `, within ${settings.cancellation.windowHours} hours of ordering` : ""}.`
          : "Orders cannot be cancelled once placed."}
      </li>
      <li>
        {settings.returns.enabled
          ? `Returnable within ${windowDays} days of delivery for a refund${settings.returns.replacementAllowed ? " or replacement" : ""}.`
          : "Returns are not accepted."}
      </li>
      {settings.returns.enabled && (
        <li>
          Return pickup charges of ₹{settings.returns.pickupCharge} are
          deducted from your refund{settings.returns.replacementAllowed ? " — replacements are free" : ""}.
        </li>
      )}
      <li>
        Refunds are processed {settings.refunds.method === "original" ? "to the original payment method" : "by the store"} within{" "}
        {settings.refunds.processingDays} business days of pickup.
      </li>
    </ul>
  );

  const deliveredAt = order.history?.slice().reverse().find((entry) => entry.status === "Delivered")?.at ?? order.date;
  const withinWindow = (now - Date.parse(deliveredAt)) / 864e5 <= windowDays;
  const cancellable = canCustomerCancel(order, settings, now);
  const canInitiate = order.status === "Delivered" && settings.returns.enabled && withinWindow;

  return (
    <div className="rounded-2xl border border-border bg-white p-5 text-xs text-text-muted">
      <p className="font-semibold text-text-primary">
        Return, replacement & refund
      </p>

      {cancellable && order.status !== "Cancelled" && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-100 bg-red-50/50 p-3">
          <p className="flex-1">
            Changed your mind? You can cancel this order now
            {settings.cancellation.fee ? ` (cancellation fee ₹${settings.cancellation.fee})` : ""}.
            {order.paymentStatus === "Paid" ? " The refund goes back to your payment method." : ""}
          </p>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`Cancel order ${order.id}?`)) return;
              cancelOrder(order.id, "Cancelled by customer");
              setReturnTick((value) => value + 1);
              window.location.reload();
            }}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700"
          >
            Cancel order
          </button>
        </div>
      )}
      {request ? (
        <ReturnRequestStatus request={request} />
      ) : canInitiate ? (
        <>
          {!showForm ? (
            <div className="mt-3 space-y-3">
              <p>
                Not satisfied with your purchase? Request a return (money
                refund) or a replacement (a new order is created for the same
                item at no extra cost).
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white transition hover:bg-burgundy-dark"
                >
                  Request return or replacement
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
              <div>
                <p className="mb-2 font-semibold text-text-primary">
                  Choose an option
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        value: "return",
                        title: "Return · Refund",
                        desc: `Pickup the item, refund minus ₹${settings.returns.pickupCharge} pickup charge`,
                      },
                      {
                        value: "replacement",
                        title: "Replacement",
                        desc: "New order created for the same item — no extra charge",
                      },
                    ] as const
                  ).filter((option) => option.value === "return" || settings.returns.replacementAllowed).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setKind(option.value)}
                      className={classNames(
                        "rounded-xl border p-3 text-left transition",
                        kind === option.value
                          ? "border-burgundy bg-warm-cream"
                          : "border-border bg-white hover:border-burgundy/40"
                      )}
                    >
                      <p className="text-sm font-bold text-text-primary">
                        {option.title}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug">
                        {option.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="return-reason"
                  className="mb-1.5 block font-semibold text-text-primary"
                >
                  Reason
                </label>
                <select
                  id="return-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="input-field"
                >
                  {RETURN_REASONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white transition hover:bg-burgundy-dark"
                >
                  {kind === "return"
                    ? "Initiate return"
                    : "Create replacement order"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-burgundy transition hover:bg-warm-cream"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <p className="mt-2">
          {settings.returns.enabled
            ? order.status === "Delivered"
              ? "The return window for this order has closed."
              : `You can request a return after delivery, within ${windowDays} days.`
            : "This store does not accept returns."}
        </p>
      )}

      <div className="mt-4 rounded-xl bg-warm-cream/60 p-3">
        {policyBullets}
      </div>
    </div>
  );
}

function ReturnRequestStatus({ request }: { request: ReturnRequest }) {
  const isReplacement = request.kind === "replacement";

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl bg-warm-cream/60 p-3">
        <p className="font-semibold text-text-primary">
          {isReplacement ? "Replacement request" : "Return request"}{" "}
          <span className="font-mono text-burgundy">{request.id}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={classNames(
              "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
              request.status === "Refunded" ||
                request.status === "Picked Up"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-burgundy/10 text-burgundy"
            )}
          >
            {request.status}
          </span>
          <span className="text-xs text-text-muted">
            Requested {new Date(request.requestedAt).toLocaleDateString("en-IN")}
          </span>
        </div>
        {request.reason && (
          <p className="mt-2 text-xs text-text-muted">
            Reason: <span className="font-medium text-text-primary">{request.reason}</span>
          </p>
        )}
      </div>

      <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
        {isReplacement ? (
          <p className="font-semibold">
            Replacement order {request.replacementOrderId ?? "—"} created — you
            will be charged nothing extra.{" "}
            <Link href="/account/orders" className="text-burgundy underline">
              View orders
            </Link>
            .
          </p>
        ) : (
          <p className="font-semibold">
            Refund of{" "}
            {request.refundAmount !== undefined
              ? `₹${request.refundAmount.toLocaleString("en-IN")}`
              : "the order value minus pickup charges"}
            {" "}
            (₹{request.returnCharges} pickup charges deducted) after the item
            is picked up and verified.
          </p>
        )}
      </div>

      <p className="text-xs text-text-muted">
        Follow the pipeline in the Tracking card above for live updates on your
        request.
      </p>
    </div>
  );
}