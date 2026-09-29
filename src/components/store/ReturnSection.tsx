"use client";

import { useState } from "react";
import Link from "next/link";
import { classNames } from "@/lib/utils";
import { initiateReturn, getReturnRequest } from "@/lib/store";
import { storeConfig } from "@/lib/constants";
import type { Order, ReturnKind, ReturnRequest } from "@/types";

const RETURN_REASONS = [
  "Damaged or defective item",
  "Wrong item delivered",
  "Edition or size mismatch",
  "No longer needed",
];

export default function ReturnSection({ order }: { order: Order }) {
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
        Cancellable within {storeConfig.cancellationWindowDays} day of placing
        the order before dispatch.
      </li>
      <li>
        Returnable within {order.returnableDays ?? storeConfig.returnDays} days
        of delivery for a refund or replacement.
      </li>
      <li>
        Return pickup charges of ₹{storeConfig.returnPickupCharges} are
        deducted from your refund — replacements are free.
      </li>
      <li>
        Refunds are processed to the original payment method within 5–7
        business days of pickup.
      </li>
    </ul>
  );

  const canInitiate = order.status === "Delivered";

  return (
    <div className="rounded-2xl border border-border bg-white p-5 text-xs text-text-muted">
      <p className="font-semibold text-text-primary">
        Return, replacement & refund
      </p>

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
                        desc: "Pickup the item, refund minus ₹50 pickup charge",
                      },
                      {
                        value: "replacement",
                        title: "Replacement",
                        desc: "New order created for the same item — no extra charge",
                      },
                    ] as const
                  ).map((option) => (
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
          You can request a return or replacement after delivery, within{" "}
          {order.returnableDays ?? storeConfig.returnDays} days.
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