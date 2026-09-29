"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import { useAuth } from "@/components/auth/AuthContext";
import { useCart } from "@/lib/use-cart";
import {
  addToCart,
  getBookById,
  setCartQuantity,
  removeFromCart,
  toggleWishlist,
  computeTotals,
  formatPrice,
  getEstimatedDeliveryDate,
  generateOrderId,
  generateTrackingId,
  pickCourier,
  saveOrder,
  clearCart,
} from "@/lib/store";
import { storeConfig } from "@/lib/constants";
import type { DeliveryAddress, OrderItem } from "@/types";

type Step = "address" | "review" | "payment" | "success";

const EMPTY_ADDRESS: DeliveryAddress = {
  fullName: "",
  phone: "",
  email: "",
  line1: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
};

export default function CheckoutClient() {
  const searchParams = useSearchParams();
  const buyNow = searchParams.get("buyNow");
  const buyQty = Number(searchParams.get("qty") ?? 1) || 1;

  const { user } = useAuth();
  const { items } = useCart();

  const [step, setStep] = useState<Step>("address");
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "store_pickup">(
    "delivery"
  );
  const [openBox, setOpenBox] = useState(true);
  const [address, setAddress] = useState<DeliveryAddress>({
    ...EMPTY_ADDRESS,
    fullName: user ? `${user.firstName} ${user.lastName}`.trim() : "",
    email: user?.email ?? "",
  });
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [orderId, setOrderId] = useState("");
  const seededRef = useRef(false);

  // Seed cart for Buy Now flow (once).
  useEffect(() => {
    if (buyNow && !seededRef.current) {
      seededRef.current = true;
      window.setTimeout(() => {
        addToCart(buyNow, buyQty);
      }, 0);
    }
  }, [buyNow, buyQty]);

  const inCheckout = buyNow
    ? items.filter((item) => item.bookId === buyNow)
    : items;

  const rows = inCheckout.flatMap((item) => {
    const book = getBookById(item.bookId);
    return book ? [{ item, book }] : [];
  });

  const rowBooksOpenBox = rows.map(({ book }) => book.openBoxDelivery);
  const openBoxSupported =
    rows.length > 0 && rowBooksOpenBox.every(Boolean);

  const orderItems: OrderItem[] = rows.map(({ item, book }) => ({
    bookId: book.id,
    title: book.title,
    quantity: item.quantity,
    price: book.price,
    originalPrice: book.originalPrice,
    currency: "INR",
  }));

  const totals = computeTotals(orderItems);

  const update = (field: keyof DeliveryAddress, value: string) =>
    setAddress((prev) => ({ ...prev, [field]: value }));

  const validateAddress = () => {
    const required: (keyof DeliveryAddress)[] = [
      "fullName",
      "phone",
      "line1",
      "city",
      "state",
      "pincode",
    ];
    for (const field of required) {
      if (!address[field]?.trim()) return `Please fill in ${field.replace(/([A-Z])/g, " $1").toLowerCase()}.`;
    }
    if (!/^\d{6}$/.test(address.pincode.trim()))
      return "Pincode must be a valid 6-digit number.";
    if (!/^[+\d][\d\s-]{9,}$/.test(address.phone.trim()))
      return "Please enter a valid phone number.";
    return "";
  };

  const placeOrder = () => {
    setProcessing(true);
    setError("");
    window.setTimeout(() => {
      const id = generateOrderId();
      const courierName = pickCourier(id);
      saveOrder({
        id,
        userId: user?.id ?? "guest",
        date: new Date().toISOString(),
        items: orderItems,
        subtotal: totals.subtotal,
        discount: totals.discount,
        gst: totals.gst,
        shipping: totals.shipping,
        total: totals.total,
        currency: "INR",
        paymentStatus: "Paid",
        status: "Ordered",
        deliveryMode,
        deliveryAddress:
          deliveryMode === "delivery"
            ? { ...address, fullName: address.fullName.trim() }
            : { ...address, fullName: "Store pickup" },
        eta: getEstimatedDeliveryDate(6),
        trackingId:
          deliveryMode === "delivery"
            ? generateTrackingId(courierName)
            : undefined,
        courierName: deliveryMode === "delivery" ? courierName : undefined,
        openBoxDelivery:
          deliveryMode === "delivery" && openBoxSupported ? openBox : false,
        returnableDays: storeConfig.returnDays,
      });
      setOrderId(id);
      clearCart();
      setStep("success");
      setProcessing(false);
    }, 1400);
  };

  const canReview = rows.length > 0;

  return (
    <div className="container grid max-w-6xl gap-10 py-10 sm:py-14 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Step indicator */}
        <ol className="flex items-center gap-2 text-xs font-semibold">
          {(["address", "review", "payment"] as Step[]).map((s, index) => {
            const current = step === s;
            const done = step === "success" || index < stepIndex(step);
            return (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] ${
                    current
                      ? "bg-burgundy text-white"
                      : done
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-warm-cream text-text-muted"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span
                  className={
                    current ? "text-text-primary" : "text-text-muted"
                  }
                >
                  {s[0].toUpperCase() + s.slice(1)}
                </span>
                {index < 2 && (
                  <span className="mx-1 h-px w-6 bg-border" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>

        {/* 1. Address */}
        {step === "address" && (
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="heading-3 mb-5">Delivery Details</h2>

            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDeliveryMode("delivery")}
                className={`rounded-xl border-2 p-4 text-left transition ${
                  deliveryMode === "delivery"
                    ? "border-burgundy bg-burgundy/5"
                    : "border-border hover:border-burgundy/40"
                }`}
              >
                <p className="text-sm font-semibold text-text-primary">
                  📦 Home Delivery
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {storeConfig.shippingFee === 0
                    ? "Free shipping"
                    : `Shipping ${formatPrice(storeConfig.shippingFee)} · free above ${formatPrice(storeConfig.freeShippingThreshold)}`}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("store_pickup")}
                className={`rounded-xl border-2 p-4 text-left transition ${
                  deliveryMode === "store_pickup"
                    ? "border-burgundy bg-burgundy/5"
                    : "border-border hover:border-burgundy/40"
                }`}
              >
                <p className="text-sm font-semibold text-text-primary">
                  🏬 Store Pickup
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Free • collect within 2–3 business days from the Foundation
                  office, Pune
                </p>
              </button>
            </div>

            {deliveryMode === "delivery" && (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="co-name">
                      Full Name
                    </label>
                    <input
                      id="co-name"
                      type="text"
                      className="input-field"
                      value={address.fullName}
                      onChange={(e) => update("fullName", e.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="co-phone">
                      Phone Number
                    </label>
                    <input
                      id="co-phone"
                      type="tel"
                      className="input-field"
                      value={address.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="co-line1">
                    Address
                  </label>
                  <input
                    id="co-line1"
                    type="text"
                    className="input-field"
                    value={address.line1}
                    onChange={(e) => update("line1", e.target.value)}
                    placeholder="House number, street, area"
                  />
                </div>

                <div className="mt-5">
                  <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="co-landmark">
                    Landmark <span className="font-normal text-text-muted">(optional)</span>
                  </label>
                  <input
                    id="co-landmark"
                    type="text"
                    className="input-field"
                    value={address.landmark ?? ""}
                    onChange={(e) => update("landmark", e.target.value)}
                    placeholder="Near…"
                  />
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="co-city">
                      City
                    </label>
                    <input
                      id="co-city"
                      type="text"
                      className="input-field"
                      value={address.city}
                      onChange={(e) => update("city", e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="co-state">
                      State
                    </label>
                    <input
                      id="co-state"
                      type="text"
                      className="input-field"
                      value={address.state}
                      onChange={(e) => update("state", e.target.value)}
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="co-pincode">
                      Pincode
                    </label>
                    <input
                      id="co-pincode"
                      type="text"
                      inputMode="numeric"
                      className="input-field"
                      value={address.pincode}
                      onChange={(e) => update("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit PIN"
                    />
                  </div>
                </div>

                {openBoxSupported && (
                  <label className="mt-5 flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={openBox}
                      onChange={(e) => setOpenBox(e.target.checked)}
                      className="mt-0.5 h-5 w-5 accent-burgundy"
                    />
                    <span className="text-text-primary">
                      <span className="font-semibold">Open-box delivery</span>{" "}
                      <span className="text-text-muted">
                        (optional) Inspect the item at the doorstep before
                        accepting delivery. Offered by the seller for this item.
                      </span>
                    </span>
                  </label>
                )}
              </>
            )}

            {deliveryMode === "store_pickup" && (
              <div className="rounded-xl border border-border bg-warm-cream p-5 text-sm">
                <p className="font-semibold text-text-primary">
                  Vaidya Gogate Memorial Foundation Office
                </p>
                <p className="mt-1 text-text-muted">
                  Pune, Maharashtra · get directions via WhatsApp when your
                  order is ready for pickup.
                </p>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={!canReview}
              onClick={() => {
                const problem =
                  deliveryMode === "delivery" ? validateAddress() : "";
                if (problem) {
                  setError(problem);
                  return;
                }
                setError("");
                setStep("review");
              }}
              className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deliveryMode === "delivery"
                ? "Continue to Review"
                : "Continue to Review"}
            </button>
          </div>
        )}

        {/* 2. Review */}
        {step === "review" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h2 className="heading-3 mb-1">Review Items</h2>
              <p className="mb-5 text-sm text-text-muted">
                You can add or remove items, and adjust quantities before
                payment.
              </p>

              <div className="space-y-5">
                {rows.map(({ item, book }) => (
                  <div
                    key={item.bookId}
                    className="flex flex-col gap-4 border-b border-border pb-5 last:border-0 last:pb-0 sm:flex-row sm:items-center"
                  >
                    <Link href={`/shop/${book.slug}`} className="shrink-0">
                      <MediaPlaceholder
                        variant="book"
                        label={book.title}
                        aspectClassName="aspect-[3/4] rounded-xl"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/shop/${book.slug}`}
                        className="font-semibold text-text-primary hover:text-burgundy"
                      >
                        {book.title}
                      </Link>
                      <p className="mt-1 text-xs text-text-muted">
                        Sold by {book.seller ?? storeConfig.sellerName}
                      </p>
                      <p className="mt-2 text-sm">
                        <span className="font-bold text-text-primary">
                          {formatPrice(book.price * item.quantity)}
                        </span>
                        {book.originalPrice && book.originalPrice > book.price && (
                          <span className="ml-2 text-text-muted line-through">
                            {formatPrice(book.originalPrice * item.quantity)}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-emerald-700">
                        Expected delivery{" "}
                        {getEstimatedDeliveryDate(6)}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <div className="flex items-center rounded-lg border border-border">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() =>
                              setCartQuantity(item.bookId, item.quantity - 1)
                            }
                            className="flex h-8 w-8 items-center justify-center transition hover:text-burgundy"
                          >
                            −
                          </button>
                          <span className="w-7 text-center text-sm font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() =>
                              setCartQuantity(item.bookId, item.quantity + 1)
                            }
                            className="flex h-8 w-8 items-center justify-center transition hover:text-burgundy"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            toggleWishlist(item.bookId);
                            removeFromCart(item.bookId);
                          }}
                          className="text-xs font-semibold text-text-muted hover:text-burgundy"
                        >
                          Move to Wishlist
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.bookId)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h2 className="heading-3 mb-4">Delivery Details</h2>
              {deliveryMode === "delivery" ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Deliver to</dt>
                    <dd className="text-right font-medium text-text-primary">
                      {address.fullName} · {address.phone}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Address</dt>
                    <dd className="text-right font-medium text-text-primary">
                      {address.line1}
                      {address.landmark ? `, ${address.landmark}` : ""},{" "}
                      {address.city} {address.state} {address.pincode}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Expected delivery</dt>
                    <dd className="text-right font-medium text-emerald-700">
                      {getEstimatedDeliveryDate(6)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-text-muted">
                  Store pickup at the Foundation office, Pune. You will be
                  notified via WhatsApp when your order is ready.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-white p-6 text-xs text-text-muted">
              <p className="font-semibold text-text-primary">
                Returns & cancellation
              </p>
              <p className="mt-1">
                You can cancel this order within {storeConfig.cancellationWindowDays} day
                of placing it. Returnable within {storeConfig.returnDays} days of
                delivery for a refund or replacement.
                {openBoxSupported &&
                  " Open-box delivery confirmation is required for returns."}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setStep("address")}
                className="btn-outline flex-1"
              >
                Back to Address
              </button>
              <button
                type="button"
                disabled={rows.length === 0}
                onClick={() => setStep("payment")}
                className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to Payment
              </button>
            </div>
          </div>
        )}

        {/* 3. Payment */}
        {step === "payment" && (
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="heading-3 mb-4">Secure Payment</h2>
            <p className="text-sm text-text-muted">
              Payments are processed securely by{" "}
              <span className="font-semibold text-text-primary">Razorpay</span>.
              Your card and bank details are never stored on our servers.
            </p>

            <div className="mt-5 flex items-center justify-between rounded-xl border border-border bg-warm-cream p-5">
              <div>
                <p className="text-sm text-text-muted">Amount payable</p>
                <p className="mt-1 text-2xl font-bold text-burgundy">
                  {formatPrice(totals.total)}
                </p>
              </div>
              <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-text-muted">
                INR
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              {["upi", "card", "netbanking"].map((method) => (
                <label
                  key={method}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm"
                >
                  <input type="radio" name="payment-method" defaultChecked={method === "upi"} className="accent-burgundy" />
                  <span className="font-medium capitalize text-text-primary">
                    {method === "upi"
                      ? "UPI / GPay / PhonePe"
                      : method === "card"
                        ? "Credit / Debit Card"
                        : "Net Banking"}
                  </span>
                </label>
              ))}
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={placeOrder}
              disabled={processing}
              className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing ? "Processing payment via Razorpay…" : `Pay ${formatPrice(totals.total)} via Razorpay`}
            </button>

            <p className="mt-4 text-center text-xs text-text-muted">
              Demo payment simulation — Razorpay live keys will be connected
              at launch. You will receive an order ID once payment succeeds.
            </p>

            <button
              type="button"
              onClick={() => setStep("review")}
              className="btn-outline mt-3 w-full"
            >
              Back to Review
            </button>
          </div>
        )}

        {/* 4. Success */}
        {step === "success" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4 12 14.01l-3-3" />
              </svg>
            </div>
            <h2 className="heading-2 mt-5">Order placed successfully!</h2>
            <p className="mt-2 text-sm text-text-muted">
              Your payment was received. Track your order anytime from My Orders.
            </p>
            <div className="mx-auto mt-6 inline-flex flex-col items-center rounded-2xl border border-emerald-200 bg-white px-8 py-5">
              <p className="text-xs uppercase tracking-[0.14em] text-text-muted">
                Order ID
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.1em] text-burgundy">
                {orderId}
              </p>
            </div>
            <p className="mt-3 text-xs text-text-muted">
              Estimated delivery: {getEstimatedDeliveryDate(6)} ·
              Live courier tracking on My Orders
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/account/orders" className="btn-primary">
                Track Your Order
              </Link>
              <Link href="/shop" className="btn-outline">
                Continue Shopping
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Order summary */}
      {step !== "success" && (
        <aside className="lg:col-span-1 lg:self-start">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
              Price Details {rows.length > 0 && `(${rows.length} item${rows.length === 1 ? "" : "s"})`}
            </h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">MRP</dt>
                <dd className="font-medium text-text-primary">
                  {formatPrice(totals.mrp)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Discount</dt>
                <dd className="font-medium text-emerald-700">
                  − {formatPrice(totals.discount)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Subtotal</dt>
                <dd className="font-medium text-text-primary">
                  {formatPrice(totals.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">GST</dt>
                <dd className="font-medium text-text-primary">
                  {formatPrice(totals.gst)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">
                  Shipping
                </dt>
                <dd className="font-medium text-text-primary">
                  {deliveryMode === "store_pickup"
                    ? `FREE`
                    : totals.shipping === 0
                      ? "FREE"
                      : formatPrice(totals.shipping)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <dt className="font-semibold text-text-primary">Total</dt>
                <dd className="font-bold text-burgundy">
                  {formatPrice(totals.total)}
                </dd>
              </div>
            </dl>

            {deliveryMode === "delivery" && step === "review" && totals.subtotal < storeConfig.freeShippingThreshold && totals.shipping > 0 && (
              <p className="mt-3 rounded-lg bg-warm-cream p-3 text-xs text-text-muted">
                Add {formatPrice(storeConfig.freeShippingThreshold - totals.subtotal)}{" "}
                more for FREE shipping.
              </p>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function stepIndex(step: Step) {
  return step === "address" ? 0 : step === "review" ? 1 : 2;
}