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
import { checkCart, getPickupLocation, type DeliveryQuote } from "@/lib/fulfillment";
import { shippingFeeFor, shippingFeeSummary } from "@/lib/integrations";
import { fetchCourierRates } from "@/lib/shipping-client";
import { payWithRazorpay, paymentNotice } from "@/lib/payments-client";
import { adjustStoreCredit, ensureCustomerAccount, getStoreCredit, sendEmail } from "@/lib/admin-store";
import { commitStockForOrder } from "@/lib/product-data";
import { useOrderSettings } from "@/lib/use-cms";
import type { CourierRate, DeliveryAddress, Order, OrderItem } from "@/types";
import { AddressFields, emptyDeliveryAddress } from "@/components/store/AddressFields";
import { formatAddressLine, isIndia, isValidPhone, isValidPostal } from "@/lib/geo";

type CourierOption = CourierRate & { key: string; deliverBy: string };

type Step = "address" | "review" | "payment" | "success";

const EMPTY_ADDRESS: DeliveryAddress = emptyDeliveryAddress();

export default function CheckoutClient() {
  const searchParams = useSearchParams();
  const buyNow = searchParams.get("buyNow");
  const buyQty = Number(searchParams.get("qty") ?? 1) || 1;

  const { user } = useAuth();
  const { items } = useCart();

  const orderSettings = useOrderSettings();
  const [step, setStep] = useState<Step>("address");
  const [chosenMode, setDeliveryMode] = useState<"delivery" | "store_pickup">(
    "delivery"
  );
  const deliveryMode = !orderSettings.deliveryEnabled
    ? "store_pickup"
    : !orderSettings.pickupEnabled
      ? "delivery"
      : chosenMode;
  const [payMethod, setPayMethod] = useState<"online" | "cod">("online");
  const [liveRates, setLiveRates] = useState<{ pincode: string; rates: CourierRate[] } | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [openBox, setOpenBox] = useState(true);
  const [address, setAddress] = useState<DeliveryAddress>({
    ...EMPTY_ADDRESS,
    fullName: user ? `${user.firstName} ${user.lastName}`.trim() : "",
    email: user?.email ?? "",
  });
  const [courierId, setCourierId] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [useCredit, setUseCredit] = useState(false);
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

  const quote: DeliveryQuote = checkCart(
    rows.map(({ item }) => ({ bookId: item.bookId, quantity: item.quantity })),
    address.pincode
  );
  const domestic = isIndia(address.countryCode);
  const pincodeValid = isValidPostal(address.countryCode, address.pincode);
  const cartKey = rows.map(({ item }) => `${item.bookId}x${item.quantity}`).join(",");
  const cartValue = rows.reduce((sum, { item, book }) => sum + book.price * item.quantity, 0);
  const cartUnits = rows.reduce((sum, { item }) => sum + item.quantity, 0);

  useEffect(() => {
    if (deliveryMode !== "delivery" || !pincodeValid || !domestic || !orderSettings.showCourierChoice) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingRates(true);
      try {
        const result = await fetchCourierRates({
          deliveryPincode: address.pincode,
          weightKg: Math.max(0.5, cartUnits * 0.5),
          declaredValue: cartValue,
          bookIds: cartKey.split(",").map((part) => part.split("x")[0]),
        });
        if (!cancelled) setLiveRates(result.live ? { pincode: address.pincode, rates: result.rates } : null);
      } catch {
        if (!cancelled) setLiveRates(null);
      } finally {
        if (!cancelled) setLoadingRates(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [address.pincode, pincodeValid, domestic, deliveryMode, orderSettings.showCourierChoice, cartKey, cartValue, cartUnits]);

  const courierOptions: CourierOption[] =
    liveRates && liveRates.pincode === address.pincode && liveRates.rates.length
      ? liveRates.rates.map((rate) => ({
          ...rate,
          key: `${rate.provider}:${rate.courierId}`,
          deliverBy: getEstimatedDeliveryDate(Math.max(1, rate.etaDays + 1)),
        }))
      : quote.offers.map((offer) => ({
          provider: "local",
          courierId: offer.id,
          courierName: offer.name,
          rate: offer.charge,
          etaDays: offer.transitDays,
          live: false,
          key: `local:${offer.id}`,
          deliverBy: offer.deliverBy,
        }));
  const selectedCourier =
    courierOptions.find((option) => option.key === courierId) ?? courierOptions[0];
  const activeCourierId = selectedCourier?.key ?? "";
  const selectedOffer = selectedCourier
    ? { name: selectedCourier.courierName, deliverBy: selectedCourier.deliverBy }
    : undefined;
  const pickupLocation = getPickupLocation();

  const orderItems: OrderItem[] = rows.map(({ item, book }) => ({
    bookId: book.id,
    title: book.title,
    quantity: item.quantity,
    price: book.price,
    originalPrice: book.originalPrice,
    currency: "INR",
  }));

  const priced = computeTotals(orderItems);
  const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const codSelected = payMethod === "cod" && orderSettings.codEnabled && deliveryMode === "delivery";
  const codFee = codSelected ? orderSettings.codFee : 0;
  const shipping =
    deliveryMode === "store_pickup" || orderItems.length === 0
      ? 0
      : shippingFeeFor(priced.subtotal, itemCount, selectedCourier?.rate, orderSettings);
  const storeCredit = user?.email ? getStoreCredit(user.email) : 0;
  const creditApplied = useCredit ? Math.min(storeCredit, Math.max(0, priced.subtotal + priced.gst + shipping + codFee)) : 0;
  const totals = {
    ...priced,
    shipping: shipping + codFee,
    storeCredit: creditApplied,
    total: Math.max(0, priced.subtotal + priced.gst + shipping + codFee - creditApplied),
  };

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
      if (!String(address[field] ?? "").trim()) return `Please fill in ${field.replace(/([A-Z])/g, " $1").toLowerCase()}.`;
    }
    if (!isValidPostal(address.countryCode, address.pincode))
      return isIndia(address.countryCode)
        ? "Pincode must be a valid 6-digit number."
        : "Please enter a valid postal code.";
    if (domestic && quote && !quote.serviceable)
      return quote.note || "Delivery is not available for this pincode.";
    if (!isValidPhone(address.phone))
      return "Please enter a valid international phone number, including country code.";
    return "";
  };

  const placeOrder = async () => {
    setProcessing(true);
    setError("");
    const id = generateOrderId();
    let payment: { paymentId?: string; razorpayOrderId?: string; method: string; paid: boolean };
    if (codSelected) {
      payment = { method: "Cash on delivery", paid: false };
    } else {
      try {
        const outcome = await payWithRazorpay({
          amount: totals.total,
          receipt: id,
          name: address.fullName || (user ? `${user.firstName} ${user.lastName}` : "Customer"),
          email: address.email || user?.email,
          phone: address.phone,
          description: `VGMF order ${id}`,
        });
        payment = {
          paymentId: outcome.paymentId,
          razorpayOrderId: outcome.kind === "paid" ? outcome.razorpayOrderId : undefined,
          method: outcome.live ? "Online" : "Online (demo)",
          paid: true,
        };
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : "Payment did not complete.");
        setProcessing(false);
        return;
      }
    }
    const courierName = selectedCourier?.courierName ?? pickCourier(id);
    const now = new Date().toISOString();
    const deliveryAddress =
      deliveryMode === "delivery"
        ? { ...address, fullName: address.fullName.trim() }
        : { ...address, fullName: address.fullName.trim() || "Store pickup" };
    if (creditApplied > 0 && user?.email) {
      adjustStoreCredit(user.email, -creditApplied, `Used on order ${id}`, id);
    }
    const account =
      user ??
      ensureCustomerAccount({
        name: deliveryAddress.fullName,
        email: deliveryAddress.email,
        phone: deliveryAddress.phone,
      });
    const order: Order = {
      id,
      userId: account?.id ?? user?.id ?? "guest",
      date: now,
      items: orderItems,
      subtotal: totals.subtotal,
      discount: totals.discount,
      gst: totals.gst,
      shipping: totals.shipping,
      total: totals.total,
      currency: "INR",
      paymentStatus: payment.paid ? "Paid" : "Pending",
      paymentMethod: payment.method,
      paidAt: payment.paid ? now : undefined,
      razorpayPaymentId: payment.paymentId,
      razorpayOrderId: payment.razorpayOrderId,
      status: "Ordered",
      channel: "online",
      storeCreditUsed: creditApplied || undefined,
      stockCommitted: false,
      deliveryMode,
      deliveryAddress,
      eta:
        deliveryMode === "store_pickup"
          ? quote?.pickupReadyBy || getEstimatedDeliveryDate(3)
          : selectedOffer?.deliverBy || quote?.deliverBy || getEstimatedDeliveryDate(6),
      trackingId:
        deliveryMode === "delivery"
          ? generateTrackingId(courierName)
          : undefined,
      courierName: deliveryMode === "delivery" ? courierName : undefined,
      courierChoice:
        deliveryMode === "delivery" && selectedCourier
          ? {
              provider: selectedCourier.provider,
              courierId: selectedCourier.courierId,
              courierName: selectedCourier.courierName,
              rate: selectedCourier.rate,
              etaDays: selectedCourier.etaDays,
              live: selectedCourier.live,
            }
          : undefined,
      openBoxDelivery:
        deliveryMode === "delivery" && openBoxSupported ? openBox : false,
      returnableDays: orderSettings.returns.enabled ? orderSettings.returns.windowDays : 0,
      createdBy: user?.email ?? "guest checkout",
      history: [
        { at: now, status: "Ordered", note: payment.paid ? `${payment.method} ${payment.paymentId ?? ""}`.trim() : payment.method, by: user?.email ?? "customer" },
      ],
    };
    if (commitStockForOrder(order)) order.stockCommitted = true;
    saveOrder(order);
    if (deliveryAddress.email) {
      sendEmail({
        to: deliveryAddress.email,
        phone: deliveryAddress.phone,
        name: deliveryAddress.fullName,
        params: [deliveryAddress.fullName, id, `₹${totals.total}`],
        subject: `Order ${id} placed`,
        template: "order-placed",
        body: `Dear Guest,\n\nNamaste, and thank you for ordering from Vaidya Gogate Memorial Foundation.\n\nWe received your order ${id}.\n\nTotal: ₹${totals.total.toLocaleString("en-IN")} (${payment.paid ? "paid" : payment.method}).\n${deliveryMode === "delivery" ? `Delivery by ${selectedOffer?.deliverBy ?? quote?.deliverBy ?? ""} via ${courierName}.` : `Pickup from ${pickupLocation.name}.`}\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
      });
    }
    setOrderId(id);
    clearCart();
    setStep("success");
    setProcessing(false);
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
              {orderSettings.deliveryEnabled && (
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
                  {shippingFeeSummary(orderSettings)}
                </p>
              </button>
              )}
              {orderSettings.pickupEnabled && (
              <button
                type="button"
                disabled={quote ? !quote.pickupAvailable : false}
                onClick={() => setDeliveryMode("store_pickup")}
                className={`rounded-xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  deliveryMode === "store_pickup"
                    ? "border-burgundy bg-burgundy/5"
                    : "border-border hover:border-burgundy/40"
                }`}
              >
                <p className="text-sm font-semibold text-text-primary">
                  Pickup from store
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Free
                  {quote?.pickupAvailable
                    ? ` · ready ${quote.pickupReadyBy}`
                    : " · unavailable for this cart"}
                </p>
              </button>
              )}
            </div>

            {deliveryMode === "delivery" && (
              <>
                <AddressFields value={address} onChange={setAddress} idPrefix="co" showEmail />

                {!domestic ? (
                  <p className="mt-5 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-ink">
                    International dispatch is available. Courier rates for India do not apply; shipping is confirmed after the order is placed.
                  </p>
                ) : null}

                {domestic && orderSettings.showCourierChoice && courierOptions.length > 0 && (
                  <fieldset className="mt-5">
                    <legend className="mb-2 text-sm font-semibold text-text-primary">
                      Choose your delivery partner {loadingRates && <span className="text-xs font-normal text-text-muted">· checking live rates…</span>}
                    </legend>
                    <div className="grid gap-2">
                      {courierOptions.map((offer) => (
                        <label
                          key={offer.key}
                          className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border px-3 py-3 text-sm ${
                            activeCourierId === offer.key
                              ? "border-burgundy bg-burgundy/5"
                              : "border-border"
                          }`}
                        >
                          <span className="flex items-start gap-2">
                            <input
                              type="radio"
                              name="courier"
                              className="mt-1 accent-burgundy"
                              checked={activeCourierId === offer.key}
                              onChange={() => setCourierId(offer.key)}
                            />
                            <span>
                              <span className="font-semibold text-text-primary">{offer.courierName}</span>
                              <span className="mt-0.5 block text-xs text-text-muted">
                                {offer.etaDays === 0 ? "Same day after dispatch" : `${offer.etaDays} business day transit`}
                              </span>
                            </span>
                          </span>
                          <span className="text-right text-xs">
                            <span className="block font-semibold text-emerald-700">by {offer.deliverBy}</span>
                            {orderSettings.shippingFeeMode === "courier_rate" && (
                              <span className="block font-semibold text-text-primary">{formatPrice(Math.round(offer.rate))}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                {domestic && quote && !quote.serviceable && pincodeValid && (
                  <p className="mt-3 text-sm text-red-700">{quote.note}</p>
                )}

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
                        accepting delivery. Offered for this item.
                      </span>
                    </span>
                  </label>
                )}
              </>
            )}

            {deliveryMode === "store_pickup" && (
              <div className="rounded-xl border border-gold/40 bg-warm-cream p-5 text-sm">
                <p className="font-semibold text-text-primary">Pickup from store</p>
                <p className="mt-1 text-text-primary">{pickupLocation.name}</p>
                <p className="mt-1 text-text-muted">{pickupLocation.address}</p>
                <p className="mt-1 text-text-muted">{pickupLocation.phone}</p>
                {quote?.pickupAvailable && (
                  <p className="mt-2 font-medium text-emerald-700">
                    Ready {quote.pickupReadyBy} · held until {quote.pickupHoldUntil}
                  </p>
                )}
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
                        Published by {book.publisher?.name ?? storeConfig.publisherName}
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
                      {formatAddressLine(address)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-muted">Expected delivery</dt>
                    <dd className="text-right font-medium text-emerald-700">
                      {selectedOffer?.deliverBy || quote?.deliverBy
                        ? `${selectedOffer?.deliverBy ?? quote?.deliverBy}${selectedOffer?.name || quote?.courier ? ` via ${selectedOffer?.name ?? quote?.courier}` : ""}`
                        : "Confirmed after a courier is booked"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-text-muted">
                  Pickup from store at {pickupLocation.name}. Ready {quote?.pickupReadyBy}. We will
                  notify you when the order can be collected.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-white p-6 text-xs text-text-muted">
              <p className="font-semibold text-text-primary">
                Returns & cancellation
              </p>
              <p className="mt-1">
                {orderSettings.cancellation.enabled
                  ? `You can cancel until the order is ${orderSettings.cancellation.allowedUntil.toLowerCase()}${orderSettings.cancellation.windowHours > 0 ? ` (within ${orderSettings.cancellation.windowHours} hours)` : ""}${orderSettings.cancellation.fee ? `, cancellation fee ${formatPrice(orderSettings.cancellation.fee)}` : ""}. `
                  : "Orders cannot be cancelled once placed. "}
                {orderSettings.returns.enabled
                  ? `Returnable within ${orderSettings.returns.windowDays} days of delivery for a refund${orderSettings.returns.replacementAllowed ? " or replacement" : ""}${orderSettings.returns.pickupCharge ? ` (return pickup ${formatPrice(orderSettings.returns.pickupCharge)})` : ""}.`
                  : "Returns are not accepted for this store."}
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
            <h2 className="heading-3 mb-4">Payment</h2>
            <p className="text-sm text-text-muted">
              Pay online with UPI, cards, net banking or wallets. Your card and bank details are never stored on our servers.
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

            {storeCredit > 0 && (
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border px-4 py-3 text-sm">
                <input type="checkbox" checked={useCredit} onChange={(event) => setUseCredit(event.target.checked)} className="mt-1 accent-burgundy" />
                <span>
                  <span className="block font-semibold text-text-primary">Use store credit ({formatPrice(storeCredit)})</span>
                  <span className="block text-xs text-text-muted">{creditApplied ? `${formatPrice(creditApplied)} will be applied` : "Applied at payment"}</span>
                </span>
              </label>
            )}

            <div className="mt-5 grid gap-3">
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ${payMethod === "online" || !codSelected ? "border-burgundy bg-burgundy/5" : "border-border"}`}>
                <input type="radio" name="payment-method" checked={!codSelected} onChange={() => setPayMethod("online")} className="mt-1 accent-burgundy" />
                <span>
                  <span className="block font-semibold text-text-primary">Pay online</span>
                  <span className="block text-xs text-text-muted">UPI, cards, net banking and wallets</span>
                </span>
              </label>
              {orderSettings.codEnabled && deliveryMode === "delivery" && (
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ${codSelected ? "border-burgundy bg-burgundy/5" : "border-border"}`}>
                  <input type="radio" name="payment-method" checked={codSelected} onChange={() => setPayMethod("cod")} className="mt-1 accent-burgundy" />
                  <span>
                    <span className="block font-semibold text-text-primary">Cash on delivery</span>
                    <span className="block text-xs text-text-muted">{orderSettings.codFee ? `${formatPrice(orderSettings.codFee)} COD fee` : "No extra fee"}</span>
                  </span>
                </label>
              )}
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
              {processing
                ? codSelected ? "Placing order…" : "Processing payment…"
                : codSelected ? `Place order · pay ${formatPrice(totals.total)} on delivery` : `Pay ${formatPrice(totals.total)}`}
            </button>

            {paymentNotice() && !codSelected && (
              <p className="mt-4 text-center text-xs text-text-muted">{paymentNotice()}</p>
            )}

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
              {codSelected ? "Pay in cash when the order arrives." : "Your payment was received."} Track your order anytime from My Orders.
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
              {creditApplied > 0 && (
                <div className="flex justify-between">
                  <dt className="text-text-muted">Store credit</dt>
                  <dd className="font-medium text-emerald-700">− {formatPrice(creditApplied)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-3">
                <dt className="font-semibold text-text-primary">Total</dt>
                <dd className="font-bold text-burgundy">
                  {formatPrice(totals.total)}
                </dd>
              </div>
            </dl>

            {deliveryMode === "delivery" && step === "review" && orderSettings.shippingFeeMode === "free_above" && totals.subtotal < orderSettings.freeAbove && totals.shipping > 0 && (
              <p className="mt-3 rounded-lg bg-warm-cream p-3 text-xs text-text-muted">
                Add {formatPrice(orderSettings.freeAbove - totals.subtotal)}{" "}
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