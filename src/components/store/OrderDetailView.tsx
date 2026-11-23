"use client";

import { hideShipping, shippingSplit } from "@/lib/order-charges";
import { useEffect, useState } from "react";
import Link from "next/link";
import OrderTrackingTimeline from "@/components/store/OrderTrackingTimeline";
import { splitParentStatus } from "@/lib/split-order";
import ReturnSection from "@/components/store/ReturnSection";
import CancelOrderSection from "@/components/store/CancelOrderSection";
import { useAuth } from "@/components/auth/AuthContext";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { addMyDeliveryAddress, getOrdersForAccount, formatPrice, purgeSampleOrders } from "@/lib/store";
import type { DeliveryAddress } from "@/types";
import { useOrderSettings } from "@/lib/use-cms";
import { printGstInvoice } from "@/lib/gst-invoice";
import { formatDate } from "@/lib/utils";
import { currentProductTitle, orderItemBatch } from "@/lib/product-data";
import { orderStatusText, shippingIsFree } from "@/lib/integrations";
import { customerOrderStatus, isHyperlocalProvider } from "@/lib/order-pipeline";
import OrderFeedback from "@/components/store/OrderFeedback";
import { agreedDelivery, customerAddressLine, deliveryDatePhrase, statusStamp } from "@/lib/delivery-expectation";
import { getShipments } from "@/lib/admin-store";

/** One order on its own page: live tracking, items, totals, delivery details and replacement requests. */
export default function OrderDetailView({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const orderSettings = useOrderSettings();
  const { ready, version } = useCommerceMirror();
  const [mounted, setMounted] = useState(false);
  const [editingCustomerInfo, setEditingCustomerInfo] = useState(false);

  useEffect(() => {
    purgeSampleOrders();
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  void version;
  const order = mounted && ready ? getOrdersForAccount(user).find((item) => item.id === orderId) : undefined;
  const shipment = order ? getShipments().find((item) => item.orderId === order.id && item.note !== "Cancelled") : undefined;

  return (
    <div>
      <Link href="/account/orders" className="text-sm font-semibold text-burgundy hover:underline">
        ← My Orders
      </Link>
      {!mounted || !ready ? (
        <p className="mt-6 text-sm text-text-muted">Loading your order…</p>
      ) : !order ? (
        <p className="mt-6 text-sm text-text-muted">This order is not on your account.</p>
      ) : (
        <>
          <h1 className="mt-4 text-xl font-semibold text-text-primary">Order {order.id}</h1>
          <p className="mt-1 text-sm text-text-muted">
            Placed {formatDate(order.date)} ·{" "}
            {order.splitInto?.length
              ? `${splitParentStatus(order.splitInto.map((row) => getOrdersForAccount(user).find((item) => item.id === row.id) ?? { status: "Ordered" }))} · ${order.splitInto.length} shipments`
              : orderStatusText(customerOrderStatus(order.status))}
          </p>
          {order.splitFrom ? (
            <p className="mt-3 rounded-xl bg-warm-cream px-4 py-3 text-sm text-text-muted">
              Shipment {order.splitPart ?? ""} of your order{" "}
              <Link className="font-semibold text-burgundy underline" href={`/account/orders/${encodeURIComponent(order.splitFrom)}`}>{order.splitFrom}</Link>
              , sent separately.{order.splitAdvance ? ` ₹${order.splitAdvance} of your advance is counted here.` : ""} The platform fee was paid once on the original order.
            </p>
          ) : null}
          {order.splitInto?.length ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-800">
              <p>This is one order, sent in {order.splitInto.length} shipments. Each shipment is tracked below.</p>
              {(order.platformFee ?? 0) > 0 ? <p className="mt-2 text-xs text-slate-600">Platform fee {formatPrice(order.platformFee ?? 0)} was paid once on this order and is not charged again.</p> : null}
            </div>
          ) : null}
          {order.preorderPayment && !order.preorderPayment.balancePaidAt && order.status !== "Cancelled" ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm text-amber-900">
                <p className="font-bold">
                  Pre-order balance
                  {order.preorderPayment.balance > 0 ? ` · ${formatPrice(order.preorderPayment.balance)}` : ""}
                  {order.preorderPayment.shippingDue ? " + courier charge" : ""}
                </p>
                <p className="mt-0.5 text-xs">
                  {order.status === "Awaiting Confirmation" || order.status === "Ordered"
                    ? "You can pay this once your order is processed."
                    : "Your order is processed. Pay the remaining amount to get it dispatched."}
                </p>
              </div>
              {order.status === "Awaiting Confirmation" || order.status === "Ordered" ? null : (
                <Link href={`/pay/${order.id}?part=balance`} className="btn-primary px-4 py-2 text-sm">
                  Proceed to pay
                </Link>
              )}
            </div>
          ) : null}
          <div className="mt-5">
      <div className="border-t border-border bg-warm-cream/40 p-5 sm:p-6">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-text-primary">
              Tracking
            </h3>
            {!isHyperlocalProvider(order.courierChoice?.provider, order.courierChoice?.lastMile, order.courierName) &&
            order.trackingId &&
            ["Shipped", "Out for Delivery", "Delivered"].includes(order.status) ? (
              <span className="max-w-[46%] text-right text-xs font-semibold break-all text-burgundy">
                {order.trackingId}
              </span>
            ) : null}
          </div>

          {order.splitInto?.length
            ? order.splitInto.map((row, index, list) => {
                const child = getOrdersForAccount(user).find((item) => item.id === row.id);
                return (
                  <div key={row.id} className="mb-6 rounded-xl border border-border p-4 last:mb-0">
                    <p className="text-sm font-semibold text-text-primary">
                      Shipment {index + 1} of {list.length} · {child ? orderStatusText(customerOrderStatus(child.status)) : "Ordered"}
                      {child?.eta && child.status !== "Delivered" ? <span className="font-normal text-text-muted"> · Expected by {child.eta}</span> : null}
                    </p>
                    <p className="mb-2 text-xs text-text-muted">
                      {(child?.items ?? []).map((item) => `${currentProductTitle(item)} × ${item.quantity}`).join(", ") || row.label}
                      {child && child.total > 0 ? ` · ${formatPrice(child.total)}` : ""}
                    </p>
                    {child ? <OrderTrackingTimeline order={child} /> : null}
                  </div>
                );
              })
            : (() => {
            const parts = getShipments()
              .filter((item) => item.orderId === order.id && item.part && item.note !== "Cancelled")
              .sort((a, b) => (a.part ?? 0) - (b.part ?? 0));
            if (parts.length < 2) return <OrderTrackingTimeline order={order} />;
            return parts.map((part) => (
              <div key={part.id} className="mb-6 border-b border-border pb-4 last:mb-0 last:border-0">
                <p className="text-sm font-semibold text-text-primary">
                  Shipment {part.part} of {parts.length} · {part.courier} {part.awb}
                </p>
                <p className="mb-2 text-xs text-text-muted">{part.items.map((item) => `${currentProductTitle(item)} × ${item.quantity}`).join(", ")}</p>
                <OrderTrackingTimeline order={{ ...order, trackingId: part.awb, courierName: part.courier }} shipmentId={part.id} />
              </div>
            ));
          })()}
        </div>

        <OrderFeedback orderId={order.id} />

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-5">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              Items
            </h4>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.bookId}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-text-primary">
                    {currentProductTitle(item)}
                    {orderItemBatch(item) ? <span className="ml-1 text-xs text-text-muted">· Batch {orderItemBatch(item)}</span> : null}
                  </span>
                  <span className="text-text-muted">
                    × {item.quantity}
                  </span>
                  <span className="font-medium text-text-primary">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-text-muted">MRP</dt>
                <dd className="font-medium text-text-primary">
                  {formatPrice(order.subtotal + order.discount)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Discount</dt>
                <dd className="font-medium text-emerald-700">
                  − {formatPrice(order.discount)}
                </dd>
              </div>
              {order.gst > 0 && (
                <div className="flex justify-between">
                  <dt className="text-text-muted">GST</dt>
                  <dd className="font-medium text-text-primary">{formatPrice(order.gst)}</dd>
                </div>
              )}
              {(order.platformFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-text-muted">Platform fee</dt>
                  <dd className="font-medium text-text-primary">{formatPrice(order.platformFee || 0)}</dd>
                </div>
              )}
              {!hideShipping(order) && (
                <div className="flex justify-between">
                  <dt className="text-text-muted">Shipping</dt>
                  <dd className="font-medium text-text-primary">
                    {order.deliveryMode === "store_pickup"
                      ? "Store pickup · no charge"
                      : order.preorderPayment?.shippingDue && !order.preorderPayment.balancePaidAt
                        ? "Calculated once packed"
                        : shippingSplit(order).courier > 0
                        ? formatPrice(shippingSplit(order).courier)
                        : order.shippingDue || order.preorderPayment?.shippingDue
                          ? "Calculated once packed"
                          : !shippingIsFree(order.subtotal) && !order.packing
                            ? formatPrice(order.shipping)
                            : "FREE"}
                  </dd>
                </div>
              )}
              {shippingSplit(order).packing > 0 && (
                <div className="flex justify-between">
                  <dt className="text-text-muted">Packing charge</dt>
                  <dd className="font-medium text-text-primary">{formatPrice(shippingSplit(order).packing)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-sm">
                <dt className="font-semibold text-text-primary">
                  Order total
                </dt>
                <dd className="font-bold text-burgundy">
                  {formatPrice(order.total)}
                </dd>
              </div>
            </dl>
            {orderSettings.gst.invoiceEnabled && (
              <button type="button" className="btn-outline mt-4" onClick={() => printGstInvoice(order)}>
                Invoice
              </button>
            )}
            {order.trackToken ? <AdjustmentNotes token={order.trackToken} /> : null}
            {order.status === "Delivered" && order.trackToken ? (
              <a
                className="btn-outline mt-4 ml-2 inline-block"
                href={`/api/shop/invoice/${order.trackToken}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download invoice
              </a>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-white p-5">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                Delivery details
              </h4>
              {order.deliveryMode === "store_pickup" ? (
                <p className="text-sm text-text-primary">
                  Store pickup at the Foundation office, Pune.
                  {order.pickupWindow ? (
                    <span className="mt-2 block font-semibold">
                      Your pickup slot:{" "}
                      {new Date(`${order.pickupWindow.date}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}, {order.pickupWindow.slot}
                    </span>
                  ) : (
                    " You will be notified when it is ready to collect."
                  )}
                </p>
              ) : order.addressRequest && !order.addressRequest.doneAt ? (
                <AddAddressForm orderId={order.id} initial={order.deliveryAddress} fix={order.addressRequest.fix} />
              ) : (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Customer</dt>
                    <dd className="text-right font-medium text-text-primary">
                      {order.deliveryAddress?.fullName}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Mobile Number</dt>
                    <dd className="text-right font-medium text-text-primary">
                      {order.deliveryAddress?.phone || user?.phone || "Not added"}
                      {order.deliveryAddress?.altPhone && order.deliveryAddress.altPhone !== order.deliveryAddress.phone
                        ? ` · Alt: ${order.deliveryAddress.altPhone}`
                        : ""}
                    </dd>
                  </div>
                  {(order.deliveryAddress?.email || order.accountEmail) ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-text-muted">Email</dt>
                      <dd className="text-right text-text-primary break-all">
                        {order.deliveryAddress?.email || order.accountEmail}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Address</dt>
                    <dd className="text-right text-text-primary">
                      {customerAddressLine(order.deliveryAddress) || "Not added"}
                    </dd>
                  </div>
                  {order.deliveryMode === "delivery" && (
                    order.status === "Delivered" || shipment?.status === "Delivered" ? (
                      <div className="flex justify-between gap-4">
                        <dt className="text-text-muted">Delivered</dt>
                        <dd className="text-right font-medium text-emerald-700">
                          {(() => {
                            const at = [...(order.history ?? [])].reverse().find((entry) => entry.status === "Delivered")?.at || shipment?.tracking?.at(-1)?.at;
                            return at ? statusStamp(at, order.deliveryAddress?.country) : "Delivered";
                          })()}
                        </dd>
                      </div>
                    ) : (
                      <div className="flex justify-between gap-4">
                        <dt className="text-text-muted">Expected delivery</dt>
                        <dd className="text-right font-medium text-emerald-700">
                          {(() => {
                            const pickedUp = ["Shipped", "Out for Delivery"].includes(customerOrderStatus(order.status)) || ["In Transit", "Out for Delivery"].includes(shipment?.status ?? "");
                            if (!pickedUp) return "Displayed after pickup by courier partner";
                            return deliveryDatePhrase(shipment?.expectedBy || order.eta) || "Pending from courier";
                          })()}
                        </dd>
                      </div>
                    )
                  )}
                </dl>
              )}
            </div>

            <CancelOrderSection order={order} />
            <ReturnSection order={order} />
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-text-muted">
          Need help with a damaged item?{" "}
          <Link
            href={`/account/tickets?order=${encodeURIComponent(order.id)}`}
            className="font-semibold text-burgundy hover:underline"
          >
            Raise a support ticket
          </Link>{" "}
          with your Order ID {order.id}.
        </p>
      </div>
          </div>
        </>
      )}
    </div>
  );
}

type AdjustmentNote = { number: string; title: string; total: number; issuedAt: string; link: string };

/** Credit notes (refunds) and debit notes (extra charges) issued for this order. */
function AdjustmentNotes({ token }: { token: string }) {
  const [notes, setNotes] = useState<AdjustmentNote[]>([]);
  useEffect(() => {
    let live = true;
    fetch(`/api/shop/invoice/${encodeURIComponent(token)}?notes=1`, { cache: "no-store" })
      .then((response) => response.json() as Promise<{ notes?: AdjustmentNote[] }>)
      .then((data) => {
        if (live) setNotes(data.notes ?? []);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [token]);
  if (!notes.length) return null;
  return (
    <ul className="mt-4 space-y-1 text-sm">
      {notes.map((note) => (
        <li key={note.number}>
          <a href={note.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-burgundy underline">
            {note.title} {note.number}
          </a>{" "}
          · {formatPrice(note.total)} · {formatDate(note.issuedAt)}
        </li>
      ))}
    </ul>
  );
}

function AddAddressForm({
  orderId,
  initial,
  fix,
  isStorePickup,
  onSaved,
}: {
  orderId: string;
  initial?: Partial<DeliveryAddress>;
  fix?: boolean;
  isStorePickup?: boolean;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? "",
    phone: initial?.phone ?? "",
    altPhone: initial?.altPhone ?? "",
    email: initial?.email ?? "",
    line1: initial?.line1 ?? "",
    landmark: initial?.landmark ?? "",
    city: initial?.city ?? "",
    state: initial?.state || "Maharashtra",
    pincode: initial?.pincode ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState("");
  const field = (key: keyof typeof form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-xs font-medium text-text-muted">
      {label}
      <input
        {...props}
        value={form[key]}
        onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary"
      />
    </label>
  );
  return (
    <form
      id="add-address"
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setSavedMsg(false);
        try {
          await addMyDeliveryAddress(orderId, form, initial?.phone || form.phone);
          setSavedMsg(true);
          if (onSaved) window.setTimeout(() => onSaved(), 600);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save the customer details.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
        {fix
          ? "Your delivery address looks incomplete or incorrect, so we are holding the parcel. Please correct it below and we will send your order."
          : isStorePickup
            ? "Mobile number and full customer address are required for all store pickup orders. Update and save your details below."
            : "Update and save your customer contact information and address below."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("fullName", "Full Name *", { required: true, autoComplete: "name" })}
        {field("phone", "Mobile Number *", { required: true, inputMode: "tel", autoComplete: "tel", placeholder: "+91 98765 43210" })}
        {field("altPhone", "Alternative Phone (optional)", { inputMode: "tel" })}
        {field("email", "Email Address *", { required: true, type: "email", autoComplete: "email" })}
      </div>
      {field("line1", "House, Building, Street, Area *", { required: true, autoComplete: "street-address" })}
      <div className="grid gap-3 sm:grid-cols-3">
        {field("landmark", "Landmark (optional)")}
        {field("city", "City *", { required: true, autoComplete: "address-level2" })}
        {field("state", "State *", { required: true, autoComplete: "address-level1" })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("pincode", "6-Digit PIN Code *", { required: true, inputMode: "numeric", pattern: "\\d{6}", maxLength: 6, autoComplete: "postal-code" })}
      </div>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      {savedMsg ? <p className="text-sm font-semibold text-emerald-700">✓ Customer & address information saved</p> : null}
      <button type="submit" disabled={busy} className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-60">
        {busy ? "Saving…" : "Save Customer & Address Details"}
      </button>
    </form>
  );
}
