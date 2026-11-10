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
  quantityCap,
  toggleWishlist,
  computeTotals,
  formatPrice,
  getEstimatedDeliveryDate,
  generateOrderId,
  getOrders,
  saveOrder,
  clearCart,
} from "@/lib/store";
import { storeConfig } from "@/lib/constants";
import { canPreorder, preorderDeliveryDate } from "@/lib/product-data";
import { checkCart, getOriginPincode, getPickupLocation, pickupInstructions, type DeliveryQuote } from "@/lib/fulfillment";
import { preorderAdvance, shippingFeeFor, shippingFeeSummary, shippingIsFree } from "@/lib/integrations";
import { fetchCourierRates, orderWeightKg } from "@/lib/shipping-client";
import { isExpressCourier, promiseFor } from "@/lib/delivery-promise";
import { openHostedCheckout, payWithRazorpay, paymentNotice, pollRazorpayOrder, readyHostedGateways, type ReadyGateway } from "@/lib/payments-client";
import { printGstInvoice } from "@/lib/gst-invoice";
import { adjustStoreCredit, ensureCustomerAccount, getStoreCredit, sendEmail } from "@/lib/admin-store";
import { commitStockForOrder } from "@/lib/product-data";
import { useLiveBooks, useOrderSettings } from "@/lib/use-cms";
import type { CourierRate, DeliveryAddress, Order, OrderItem } from "@/types";
import { AddressFields, emptyDeliveryAddress } from "@/components/store/AddressFields";
import Glyph from "@/components/store/Glyph";
import QtyControl from "@/components/store/QtyControl";
import { markCartRecovered } from "@/lib/abandoned-cart";
import { saveForLater } from "@/lib/saved-later";
import { SavedCardTiles } from "@/components/account/SavedCards";
import { saveAddress, useSavedAddresses, useSavedCards, brandLabel } from "@/lib/account-wallet";
import { formatAddressLine, isIndia, isValidPhone, isValidPostal } from "@/lib/geo";
import { getPlatformCountries, isCountryEnabled } from "@/lib/platform-countries";
import { customerCourierRates } from "@/lib/checkout-couriers";

const CHECKOUT_MINUTES = 10;

type CourierOption = CourierRate & { key: string; deliverBy: string; dayLabel?: string; express: boolean };

/** The courier's own delivery date, shown like our estimates (e.g. 8 Nov 2026). */
function courierDate(value?: string) {
  const at = value ? Date.parse(value) : NaN;
  return Number.isNaN(at) ? "" : new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

type Step = "address" | "review" | "payment" | "success";

const EMPTY_ADDRESS: DeliveryAddress = emptyDeliveryAddress();
const PENDING_CHECKOUT = "vgmf_pending_checkout";
const GATEWAY_LABEL: Record<ReadyGateway["id"], string> = { payu: "PayU", easebuzz: "Easebuzz", cashfree: "Cashfree", phonepe: "PhonePe" };

export default function CheckoutClient() {
  const searchParams = useSearchParams();
  const buyNow = searchParams.get("buyNow");
  const buyQty = Number(searchParams.get("qty") ?? 1) || 1;

  const { user } = useAuth();
  const { items } = useCart();
  const catalogue = useLiveBooks();

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
  const [payMethod, setPayMethod] = useState<"online" | "cod" | "store" | ReadyGateway["id"]>("online");
  const [hostedGateways, setHostedGateways] = useState<ReadyGateway[]>([]);
  const [liveRates, setLiveRates] = useState<{ pincode: string; rates: CourierRate[] } | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [address, setAddress] = useState<DeliveryAddress>({
    ...EMPTY_ADDRESS,
    fullName: user ? `${user.firstName} ${user.lastName}`.trim() : "",
    email: user?.email ?? "",
  });
  const [courierId] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const processingRef = useRef(false);
  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);
  useEffect(() => {
    const key = "vgmf_checkout_deadline";
    if (step === "success") {
      window.sessionStorage.removeItem(key);
      return;
    }
    const fresh = () => window.sessionStorage.setItem(key, String(Date.now() + CHECKOUT_MINUTES * 60_000));
    if (Number(window.sessionStorage.getItem(key) || 0) <= Date.now()) fresh();
    const tick = () => {
      const left = Math.round((Number(window.sessionStorage.getItem(key) || 0) - Date.now()) / 1000);
      if (left <= 0 && !processingRef.current && !new URLSearchParams(window.location.search).get("orderId")) {
        window.clearInterval(timer);
        window.sessionStorage.removeItem(key);
        let pendingId = "";
        try {
          pendingId = (JSON.parse(window.sessionStorage.getItem(PENDING_CHECKOUT) || "null") as Order | null)?.id || "";
        } catch {}
        window.sessionStorage.removeItem(PENDING_CHECKOUT);
        if (pendingId) {
          void fetch("/api/payments/hosted", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "expire", orderId: pendingId }),
            keepalive: true,
          }).catch(() => {});
        }
        window.sessionStorage.setItem("vgmf_checkout_expired", "1");
        window.location.assign("/cart");
        return;
      }
      setSecondsLeft(Math.max(0, left));
    };
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [step]);
  const [holdingNote, setHoldingNote] = useState("");
  const [razorpayHold, setRazorpayHold] = useState("");
  const [orderId, setOrderId] = useState("");
  const [placedEta, setPlacedEta] = useState("");
  const [useCredit, setUseCredit] = useState(false);
  const seededRef = useRef(false);
  const addressSeeded = useRef(false);
  const paymentReturn = useRef("");
  const paidOnce = useRef(false);
  const savedAddresses = useSavedAddresses(user?.email);
  const savedCards = useSavedCards(user?.email);
  const [addressChoice, setAddressChoice] = useState("new");
  const [keepAddress, setKeepAddress] = useState(true);
  const [cardChoice, setCardChoice] = useState("");

  // Seed cart for Buy Now flow (once).
  useEffect(() => {
    if (buyNow && !seededRef.current) {
      seededRef.current = true;
      window.setTimeout(() => {
        addToCart(buyNow, buyQty);
      }, 0);
    }
  }, [buyNow, buyQty]);

  useEffect(() => {
    if (addressSeeded.current || !savedAddresses.length) return;
    const chosen = savedAddresses.find((item) => item.isDefault) ?? savedAddresses[0];
    addressSeeded.current = true;
    setAddress({ ...chosen, email: chosen.email || user?.email || "" });
    setAddressChoice(chosen.id);
  }, [savedAddresses, user?.email]);

  useEffect(() => {
    void readyHostedGateways().then(setHostedGateways).catch(() => setHostedGateways([]));
  }, []);

  const finishPaidCheckout = (reference?: string) => {
    if (paidOnce.current) return;
    const raw = window.sessionStorage.getItem(PENDING_CHECKOUT);
    if (!raw) {
      setError("The payment is confirmed, but this browser no longer has the checkout.");
      return;
    }
    try {
      const order = JSON.parse(raw) as Order;
      if (searchParams.get("orderId") && searchParams.get("orderId") !== order.id) return;
      const paid: Order = {
        ...order,
        paymentStatus: "Paid",
        paidAt: new Date().toISOString(),
        paymentMethod: GATEWAY_LABEL[searchParams.get("gateway") as ReadyGateway["id"]] || order.paymentMethod,
        paymentRef: reference || searchParams.get("ref") || order.paymentRef,
      };
      if (commitStockForOrder(paid)) paid.stockCommitted = true;
      if (paid.storeCreditUsed && paid.accountEmail) {
        adjustStoreCredit(paid.accountEmail, -paid.storeCreditUsed, `Used on order ${paid.id}`, paid.id);
      }
      paidOnce.current = true;
      saveOrder(paid);
      window.sessionStorage.removeItem(PENDING_CHECKOUT);
      markCartRecovered();
      clearCart();
      setHoldingNote("");
      setOrderId(paid.id);
      setStep("success");
    } catch {
      setError("The payment returned, but the checkout could not be restored.");
    }
  };

  useEffect(() => {
    const flag = searchParams.get("payment");
    if (flag !== "paid" && flag !== "failed" && flag !== "holding") return;
    const key = searchParams.toString();
    if (paymentReturn.current === key) return;
    paymentReturn.current = key;
    if (flag === "failed") {
      setHoldingNote("");
      setError("The payment was not completed. You can try again.");
      setStep("payment");
      return;
    }
    if (flag === "holding") {
      setError("");
      setHoldingNote("The payment is on hold until the payment service confirms it. This page will update when that arrives. The order is not packed before then.");
      setStep("payment");
      return;
    }
    finishPaidCheckout();
    // finishPaidCheckout reads the current search params when the return flag changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!holdingNote) return;
    const orderId = searchParams.get("orderId") || "";
    if (!orderId) return;
    let stop = false;
    const tick = async () => {
      const response = await fetch(`/api/payments/hosted?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as { status?: string; reference?: string } | null;
      if (stop || !data) return;
      if (data.status === "confirmed") finishPaidCheckout(data.reference);
      if (data.status === "failed") {
        setHoldingNote("");
        setError("The payment service did not confirm this payment. You can try again.");
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 5000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingNote, searchParams]);

  useEffect(() => {
    if (!razorpayHold) return;
    let stop = false;
    const tick = async () => {
      const paymentId = await pollRazorpayOrder(razorpayHold).catch(() => "");
      if (stop || !paymentId) return;
      setRazorpayHold("");
      finishPaidCheckout(paymentId);
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 5000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [razorpayHold]);

  useEffect(() => {
    if (cardChoice || !savedCards.length) return;
    setCardChoice((savedCards.find((item) => item.isDefault) ?? savedCards[0]).id);
  }, [cardChoice, savedCards]);

  const inCheckout = buyNow
    ? items.filter((item) => item.bookId === buyNow)
    : items;

  const rows = inCheckout.flatMap((item) => {
    const book = catalogue.find((entry) => entry.id === item.bookId) ?? getBookById(item.bookId);
    return book ? [{ item, book }] : [];
  });

  const quote: DeliveryQuote = checkCart(
    rows.map(({ item }) => ({ bookId: item.bookId, quantity: item.quantity })),
    address.pincode
  );
  const domestic = isIndia(address.countryCode);
  const pincodeValid = isValidPostal(address.countryCode, address.pincode);
  const cartKey = rows.map(({ item }) => `${item.bookId}x${item.quantity}`).join(",");
  const cartValue = rows.reduce((sum, { item, book }) => sum + book.price * item.quantity, 0);
  const cartUnits = rows.reduce((sum, { item }) => sum + item.quantity, 0);
  const preorderBook = rows.find(({ book }) => canPreorder(book))?.book;
  const hasPreorder = Boolean(preorderBook);

  useEffect(() => {
    if (deliveryMode !== "delivery" || !pincodeValid || !domestic || !orderSettings.showCourierChoice || hasPreorder) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingRates(true);
      try {
        const result = await fetchCourierRates({
          deliveryPincode: address.pincode,
          weightKg: orderWeightKg({
            items: cartKey.split(",").map((part) => ({ bookId: part.split("x")[0], quantity: Number(part.split("x")[1]) || 1 })) as Order["items"],
          }),
          declaredValue: cartValue,
          bookIds: cartKey.split(",").map((part) => part.split("x")[0]),
        });
        if (!cancelled) setLiveRates({ pincode: address.pincode, rates: result.rates });
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
  }, [address.pincode, pincodeValid, domestic, deliveryMode, orderSettings.showCourierChoice, hasPreorder, cartKey, cartValue, cartUnits]);

  const courierOptions: CourierOption[] =
    liveRates && liveRates.pincode === address.pincode
      ? customerCourierRates(liveRates.rates, orderSettings)
        .map((rate) => {
          const samePincode = address.pincode.replace(/\D/g, "") === getOriginPincode();
          const promise = promiseFor(rate, rate.deliverBy ? Date.parse(rate.deliverBy) : NaN, samePincode, orderSettings.processingHours, orderSettings.dispatchCutoff);
          return {
            ...rate,
            key: `${rate.provider}:${rate.courierId}`,
            deliverBy: promise.deliverBy || courierDate(rate.deliverBy) || getEstimatedDeliveryDate(Math.max(1, rate.etaDays + 1)),
            dayLabel: promise.dayLabel,
            express: isExpressCourier(rate),
          };
        })
      : [];
  const selectedCourier =
    courierOptions.find((option) => option.key === courierId) ?? courierOptions[0];
  const selectedOffer = selectedCourier
    ? { name: selectedCourier.courierName, deliverBy: selectedCourier.dayLabel ? `${selectedCourier.dayLabel}, ${selectedCourier.deliverBy}` : selectedCourier.deliverBy }
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
  const cashAtStoreSelected = payMethod === "store" && orderSettings.cashAtStoreEnabled && deliveryMode === "store_pickup";
  const codSelected = (payMethod === "cod" && orderSettings.codEnabled && deliveryMode === "delivery") || cashAtStoreSelected;
  const hostedSelected = payMethod === "payu" || payMethod === "easebuzz" || payMethod === "cashfree" || payMethod === "phonepe" ? payMethod : "";
  const codFee = codSelected && !cashAtStoreSelected ? orderSettings.codFee : 0;
  const shipping =
    deliveryMode === "store_pickup" || orderItems.length === 0 || hasPreorder
      ? 0
      : shippingFeeFor(priced.subtotal, itemCount, selectedCourier?.rate, orderSettings);
  const storeCredit = user?.email ? getStoreCredit(user.email) : 0;
  const creditApplied = useCredit ? Math.min(storeCredit, Math.max(0, priced.subtotal + priced.gst + priced.platformFee + shipping + codFee)) : 0;
  const totals = {
    ...priced,
    shipping: shipping + codFee,
    storeCredit: creditApplied,
    total: Math.max(0, priced.subtotal + priced.gst + priced.platformFee + shipping + codFee - creditApplied),
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
    if (!isCountryEnabled(address.countryCode, getPlatformCountries()))
      return "The Foundation is not delivering to this country yet.";
    return "";
  };

  const preorderBalanceLater = orderItems.some((item) => item.preorder) && orderSettings.preorderPayment.mode === "advance" && payMethod === "online";
  const payNow = preorderBalanceLater ? preorderAdvance(totals.total, orderSettings) : totals.total;
  const preorderShippingLater = hasPreorder && deliveryMode === "delivery";

  const placeOrder = async () => {
    const over = rows.find(({ item, book }) => item.quantity > quantityCap(book.id) || (book.stock <= 0 && !book.preorder?.enabled));
    if (over) {
      setError(`${over.book.title}: that quantity is not available. Lower the quantity or save it for later.`);
      return;
    }
    setProcessing(true);
    setError("");
    const id = generateOrderId();
    let payment: { paymentId?: string; razorpayOrderId?: string; method: string; paid: boolean };
    let awaitingGateway = false;
    const hosted = hostedSelected;
    if (cashAtStoreSelected) {
      payment = { method: "Cash at Store", paid: false };
    } else if (codSelected) {
      payment = { method: "Cash on delivery", paid: false };
    } else if (hosted) {
      payment = { method: GATEWAY_LABEL[hosted], paid: false };
    } else {
      try {
        const outcome = await payWithRazorpay({
          amount: payNow,
          receipt: id,
          name: address.fullName || (user ? `${user.firstName} ${user.lastName}` : "Customer"),
          email: address.email || user?.email,
          phone: address.phone,
          description: `VGMF order ${id}`,
        });
        if (outcome.kind === "holding") {
          awaitingGateway = true;
          payment = {
            paymentId: outcome.paymentId,
            razorpayOrderId: outcome.razorpayOrderId,
            method: "Online",
            paid: false,
          };
        } else {
          payment = {
            paymentId: outcome.paymentId,
            razorpayOrderId: outcome.kind === "paid" ? outcome.razorpayOrderId : undefined,
            method: outcome.live ? "Online" : "Online (demo)",
            paid: true,
          };
        }
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : "Payment did not complete.");
        setProcessing(false);
        return;
      }
    }
    const courierName = selectedCourier?.courierName;
    const now = new Date().toISOString();
    const deliveryAddress =
      deliveryMode === "delivery"
        ? { ...address, fullName: address.fullName.trim() }
        : { ...address, fullName: address.fullName.trim() || "Store pickup" };
    if (creditApplied > 0 && user?.email && !hosted && !awaitingGateway) {
      adjustStoreCredit(user.email, -creditApplied, `Used on order ${id}`, id);
    }
    const account =
      user ??
      ensureCustomerAccount({
        name: deliveryAddress.fullName,
        email: deliveryAddress.email,
        phone: deliveryAddress.phone,
      });
    const firstStatus: Order["status"] =
      orderSettings.confirmMode !== "manual" && orderItems.every((item) => !item.preorder) && rows.every(({ item, book }) => book.stock >= item.quantity) ? "Ordered" : "Awaiting Confirmation";
    const order: Order = {
      id,
      userId: account?.id ?? user?.id ?? "guest",
      date: now,
      items: orderItems,
      subtotal: totals.subtotal,
      discount: totals.discount,
      gst: totals.gst,
      platformFee: totals.platformFee,
      shipping: totals.shipping,
      total: totals.total,
      currency: "INR",
      paymentStatus: payment.paid ? (payNow < totals.total || preorderShippingLater ? "Partially Paid" : "Paid") : "Pending",
      paymentMethod: payment.method,
      paidAt: payment.paid ? now : undefined,
      razorpayPaymentId: payment.paymentId,
      razorpayOrderId: payment.razorpayOrderId,
      status: firstStatus,
      channel: "online",
      storeCreditUsed: creditApplied || undefined,
      preorderPayment:
        payNow < totals.total || preorderShippingLater
          ? {
              advance: payNow,
              balance: Math.round((totals.total - payNow) * 100) / 100,
              balanceWhen: orderSettings.preorderPayment.balanceWhen,
              advancePaidAt: payment.paid ? now : undefined,
              shippingDue: preorderShippingLater || undefined,
            }
          : undefined,
      stockCommitted: false,
      deliveryMode,
      deliveryAddress,
      eta:
        deliveryMode === "store_pickup"
          ? quote?.pickupReadyBy || getEstimatedDeliveryDate(3)
          : selectedOffer?.deliverBy || quote?.deliverBy || getEstimatedDeliveryDate(6),
      pickupHoldUntil: deliveryMode === "store_pickup" ? quote?.pickupHoldUntil : undefined,
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
              lastMile: selectedCourier.lastMile,
            }
          : undefined,
      returnableDays: orderSettings.returns.enabled ? orderSettings.returns.windowDays : 0,
      accountEmail: (user?.email || deliveryAddress.email || "").trim().toLowerCase() || undefined,
      createdBy: user?.email ?? "guest checkout",
      history: [
        { at: now, status: firstStatus, note: payment.paid ? `${payment.method} ${payment.paymentId ?? ""}`.trim() : payment.method, by: user?.email ?? "customer" },
      ],
    };
    if (hosted || awaitingGateway) {
      window.sessionStorage.setItem(PENDING_CHECKOUT, JSON.stringify(order));
      await fetch("/api/payments/hosted", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "hold",
          gateway: hosted || "razorpay",
          orderId: id,
          amount: totals.total,
          kind: "order",
          reference: payment.razorpayOrderId || "",
        }),
      }).catch(() => undefined);
      if (awaitingGateway && payment.razorpayOrderId) {
        setHoldingNote("The payment is on hold until Razorpay confirms it. This page will update when that arrives. The order is not packed before then.");
        setRazorpayHold(payment.razorpayOrderId);
        setStep("payment");
        setProcessing(false);
        return;
      }
      if (!hosted) return;
      try {
        await openHostedCheckout({
          gateway: hosted,
          amount: totals.total,
          orderId: id,
          name: deliveryAddress.fullName,
          email: deliveryAddress.email,
          phone: deliveryAddress.phone,
        });
      } catch (problem) {
        window.sessionStorage.removeItem(PENDING_CHECKOUT);
        setError(problem instanceof Error ? problem.message : "The payment gateway did not open.");
        setProcessing(false);
      }
      return;
    }
    if (commitStockForOrder(order)) order.stockCommitted = true;
    saveOrder(order);
    if (deliveryAddress.email || deliveryAddress.phone) {
      const pickupNote =
        deliveryMode === "delivery"
          ? `Delivery by ${selectedOffer?.deliverBy ?? quote?.deliverBy ?? ""}.`
          : pickupInstructions();
      sendEmail({
        to: deliveryAddress.email || "",
        phone: deliveryAddress.phone,
        name: deliveryAddress.fullName,
        params: [deliveryAddress.fullName, id, `₹${totals.total}`],
        subject: `Order ${id} placed`,
        template: "order-placed",
        body: `Dear Guest,\n\nNamaste, and thank you for ordering from Vaidya Gogate Memorial Foundation.\n\nWe received your order ${id}.\n\nTotal: ₹${totals.total.toLocaleString("en-IN")} (${payment.paid ? "paid" : payment.method}).\n${pickupNote}\n\nWith warm regards,\nVaidya Gogate Memorial Foundation`,
      });
    }
    setOrderId(id);
    setPlacedEta(order.eta ?? "");
    markCartRecovered();
    clearCart();
    setStep("success");
    setProcessing(false);
  };

  const canReview = rows.length > 0;

  return (
    <div className="container grid max-w-6xl gap-10 py-10 sm:py-14 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Step indicator */}
        <ol className="relative grid grid-cols-3 text-xs font-semibold sm:text-sm" aria-label="Checkout steps">
          <span className="absolute left-[16.66%] right-[16.66%] top-4 h-1 rounded-full bg-border" aria-hidden="true" />
          <span
            className="absolute left-[16.66%] top-4 h-1 rounded-full bg-emerald-600 transition-[width] duration-700 ease-out"
            style={{ width: `${(Math.min(step === "success" ? 2 : stepIndex(step), 2) / 2) * 66.68}%` }}
            aria-hidden="true"
          />
          {(["address", "review", "payment"] as Step[]).map((s, index) => {
            const current = step === s;
            const done = step === "success" || index < stepIndex(step);
            return (
              <li key={s} className="relative flex flex-col items-center gap-1.5 text-center" aria-current={current ? "step" : undefined}>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                    done
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : current
                        ? "border-emerald-600 bg-white text-emerald-700 ring-4 ring-emerald-100"
                        : "border-border bg-white text-text-muted"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span className={done || current ? "text-text-primary" : "text-text-muted"}>
                  {s === "address" ? "Address" : s === "review" ? "Review" : "Payment"}
                </span>
              </li>
            );
          })}
        </ol>

        {/* 1. Address */}
        {secondsLeft !== null && step !== "success" ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900" role="timer">
            <span>Complete your order within {CHECKOUT_MINUTES} minutes</span>
            <b className="text-base tabular-nums">
              {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}
            </b>
          </div>
        ) : null}
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
                <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <Glyph name="truck" className="h-4 w-4 text-burgundy" />
                  Home delivery
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {hasPreorder ? "Courier charge is added when you pay the balance" : shippingFeeSummary(orderSettings)}
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
                <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <Glyph name="store" className="h-4 w-4 text-burgundy" />
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
                {user && savedAddresses.length > 0 && (
                  <div className="mb-5 grid gap-2">
                    {savedAddresses.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setAddressChoice(item.id);
                          setAddress({ ...item, email: item.email || user.email });
                        }}
                        className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left ${addressChoice === item.id ? "border-burgundy bg-burgundy/5" : "border-border bg-white"}`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warm-cream text-burgundy">
                          <Glyph name={item.place === "office" ? "office" : "home"} className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-ink">{item.place === "office" ? "Office" : "Home"}{item.isDefault ? " · default" : ""}</span>
                          <span className="block text-xs text-text-muted">{formatAddressLine(item)}</span>
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setAddressChoice("new");
                        setAddress(emptyDeliveryAddress({ fullName: `${user.firstName} ${user.lastName}`.trim(), email: user.email, phone: user.phone }));
                      }}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold ${addressChoice === "new" ? "border-burgundy bg-burgundy/5 text-burgundy" : "border-border text-text-primary"}`}
                    >
                      <Glyph name="plus" className="h-4 w-4" />
                      Add a new address
                    </button>
                  </div>
                )}
                {addressChoice === "new" || savedAddresses.length === 0 ? (
                  <AddressFields value={address} onChange={setAddress} idPrefix="co" showEmail />
                ) : (
                  <div className="rounded-xl border border-border bg-warm-cream p-4 text-sm">
                    <p className="flex items-center gap-2 font-semibold text-ink">
                      <Glyph name="pin" className="h-4 w-4 text-burgundy" />
                      {address.fullName} · {address.phone}
                    </p>
                    <p className="mt-1 text-text-muted">{formatAddressLine(address)}</p>
                  </div>
                )}
                {user && (
                  <label className="mt-4 flex items-start gap-2 text-sm text-text-primary">
                    <input type="checkbox" className="mt-1 accent-burgundy" checked={keepAddress} onChange={(event) => setKeepAddress(event.target.checked)} />
                    <span>Save this address in my account</span>
                  </label>
                )}

                {!domestic ? (
                  <p className="mt-5 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-ink">
                    International dispatch is available. Courier rates for India do not apply; shipping is confirmed after the order is placed.
                  </p>
                ) : null}

                {domestic && preorderBook && !orderSettings.hideDeliveryDates && (
                  <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <b>Tentative delivery by</b> {preorderDeliveryDate(preorderBook)}
                  </p>
                )}
                {domestic && !hasPreorder && !orderSettings.hideDeliveryDates && orderSettings.showCourierChoice && (selectedOffer || loadingRates) && (
                  <p className="mt-5 rounded-xl border border-border bg-white px-4 py-3 text-sm text-text-primary">
                    <b>Expected delivery by</b> {selectedOffer ? selectedOffer.deliverBy : <span className="text-text-muted">checking…</span>}
                  </p>
                )}
                {domestic && quote && !quote.serviceable && pincodeValid && (
                  <p className="mt-3 text-sm text-red-700">{quote.note}</p>
                )}
              </>
            )}

            {deliveryMode === "store_pickup" && (
              <div className="rounded-xl border border-gold/40 bg-warm-cream p-5 text-sm">
                <p className="font-semibold text-text-primary">Pickup from store</p>
                <p className="mt-1 text-text-primary">{pickupLocation.name}</p>
                <p className="mt-1 text-text-muted">{pickupLocation.address}</p>
                <p className="mt-1 text-text-muted">
                  Point of contact: {[pickupLocation.contactName, pickupLocation.contactPhone].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-text-muted">Pickup timings: {pickupLocation.hours}</p>
                <a href={pickupLocation.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-burgundy underline">
                  <Glyph name="pin" className="h-3.5 w-3.5" /> Open in Google Maps
                </a>
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
                if (user?.email && keepAddress) {
                  saveAddress(user.email, { ...address, id: addressChoice === "new" ? undefined : addressChoice });
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
                        <span className="text-base font-bold text-text-primary">
                          {formatPrice(book.price * item.quantity)}
                        </span>
                        {book.originalPrice != null && book.originalPrice > book.price ? (
                          <span className="ml-2 text-xs text-text-muted">
                            MRP <span className="line-through">{formatPrice(book.originalPrice * item.quantity)}</span>{" "}
                            <b className="text-emerald-700">{Math.round((1 - book.price / book.originalPrice) * 100)}% off</b>
                          </span>
                        ) : null}
                      </p>
                      {orderSettings.hideDeliveryDates ? null : (
                      <p className="mt-1 text-xs font-semibold text-emerald-700">
                        {deliveryMode === "store_pickup"
                          ? `Ready for pickup ${quote?.pickupReadyBy || ""}`.trim()
                          : canPreorder(book)
                            ? `Tentative delivery by ${preorderDeliveryDate(book)}`
                            : `Expected delivery ${selectedOffer?.deliverBy || quote?.deliverBy || "shown once you enter the delivery pincode"}`}
                      </p>
                      )}

                      <p className="mt-1 text-xs text-text-muted">Qty {item.quantity} · {formatPrice(book.price)} each</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <QtyControl value={item.quantity} max={quantityCap(book.id)} onChange={(quantity) => setCartQuantity(item.bookId, quantity)} />
                        <button type="button" onClick={() => saveForLater(item.bookId)} className="text-xs font-semibold text-text-muted hover:text-burgundy">
                          Save for later
                        </button>
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
                      {formatAddressLine(address)}
                    </dd>
                  </div>
                  {orderSettings.hideDeliveryDates ? null : deliveryMode === "delivery" && preorderBook ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-text-muted">Tentative delivery by</dt>
                      <dd className="text-right font-medium text-emerald-700">{preorderDeliveryDate(preorderBook)}</dd>
                    </div>
                  ) : selectedOffer?.deliverBy || quote?.deliverBy ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-text-muted">Expected delivery</dt>
                      <dd className="text-right font-medium text-emerald-700">
                        {selectedOffer?.deliverBy ?? quote?.deliverBy}
                      </dd>
                    </div>
                  ) : null}
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
                Replacements
              </p>
              <p className="mt-1">
                Orders cannot be cancelled or returned from your account. If an item arrives damaged, share photos from My Orders. The Foundation desk accepts or rejects the request, and an accepted request is fulfilled with a new free order.
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
            <h2 className="heading-3 mb-4 flex items-center gap-2">
              <Glyph name="lock" className="h-5 w-5 text-burgundy" />
              Payment
            </h2>
            <p className="text-sm text-text-muted">
              Pay online with UPI, cards, net banking or wallets. A saved card keeps only the brand and last four digits. The secure payment window still collects the payment.
            </p>
            {savedCards.length > 0 && !codSelected && (
              <>
                <SavedCardTiles cards={savedCards} selectedId={cardChoice} onSelect={setCardChoice} />
                <p className="mt-2 text-xs text-text-muted">
                  {(() => {
                    const chosen = savedCards.find((card) => card.id === cardChoice);
                    return chosen ? `Use your ${brandLabel(chosen.brand)} ending ${chosen.last4} in the payment window.` : "Choose a saved card to remember which one to use.";
                  })()}
                </p>
              </>
            )}

            <div className="mt-5 flex items-center justify-between rounded-xl border border-border bg-warm-cream p-5">
              <div>
                <p className="text-sm text-text-muted">{payNow < totals.total ? "Advance payable now" : "Amount payable"}</p>
                <p className="mt-1 text-2xl font-bold text-burgundy">
                  {formatPrice(payNow)}
                </p>
                {payNow < totals.total ? (
                  <p className="mt-1 text-xs text-text-muted">
                    Pre-order: balance {formatPrice(totals.total - payNow)} of {formatPrice(totals.total)}{" "}
                    {orderSettings.preorderPayment.balanceWhen === "on_ready" ? "when the item is ready" : "before dispatch"}. We send you a payment link.
                  </p>
                ) : null}
                {preorderShippingLater ? (
                  <p className="mt-1 text-xs text-text-muted">
                    Pre-order: the courier charge is worked out when your order is ready and added to the balance you pay then.
                  </p>
                ) : null}
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
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ${payMethod === "online" ? "border-burgundy bg-burgundy/5" : "border-border"}`}>
                <input type="radio" name="payment-method" checked={payMethod === "online"} onChange={() => setPayMethod("online")} className="mt-1 accent-burgundy" />
                <span>
                  <span className="flex items-center gap-2 font-semibold text-text-primary"><Glyph name="card" className="h-4 w-4 text-burgundy" /> Pay online</span>
                  <span className="block text-xs text-text-muted">UPI, cards, net banking and wallets</span>
                </span>
              </label>
              {hostedGateways.map((gateway) => (
                <label key={gateway.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ${payMethod === gateway.id ? "border-burgundy bg-burgundy/5" : "border-border"}`}>
                  <input type="radio" name="payment-method" checked={payMethod === gateway.id} onChange={() => setPayMethod(gateway.id)} className="mt-1 accent-burgundy" />
                  <span>
                    <span className="flex items-center gap-2 font-semibold text-text-primary"><Glyph name="card" className="h-4 w-4 text-burgundy" /> {GATEWAY_LABEL[gateway.id]}</span>
                    <span className="block text-xs text-text-muted">{gateway.mode === "live" ? "Secure hosted checkout" : "Test checkout"}</span>
                  </span>
                </label>
              ))}
              {orderSettings.codEnabled && deliveryMode === "delivery" && (
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ${codSelected ? "border-burgundy bg-burgundy/5" : "border-border"}`}>
                  <input type="radio" name="payment-method" checked={codSelected} onChange={() => setPayMethod("cod")} className="mt-1 accent-burgundy" />
                  <span>
                    <span className="flex items-center gap-2 font-semibold text-text-primary"><Glyph name="package" className="h-4 w-4 text-burgundy" /> Cash on delivery</span>
                    <span className="block text-xs text-text-muted">{orderSettings.codFee ? `${formatPrice(orderSettings.codFee)} COD fee` : "No extra fee"}</span>
                  </span>
                </label>
              )}
              {orderSettings.cashAtStoreEnabled && deliveryMode === "store_pickup" && (
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ${cashAtStoreSelected ? "border-burgundy bg-burgundy/5" : "border-border"}`}>
                  <input type="radio" name="payment-method" checked={cashAtStoreSelected} onChange={() => setPayMethod("store")} className="mt-1 accent-burgundy" />
                  <span>
                    <span className="flex items-center gap-2 font-semibold text-text-primary"><Glyph name="package" className="h-4 w-4 text-burgundy" /> Cash at Store</span>
                    <span className="block text-xs text-text-muted">Pay at the clinic counter when you collect the order</span>
                  </span>
                </label>
              )}
            </div>

            {holdingNote && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{holdingNote}</p>
            )}
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
                : codSelected ? `Place order · pay ${formatPrice(totals.total)} ${cashAtStoreSelected ? "at the store" : "on delivery"}` : `Pay ${formatPrice(totals.total)}`}
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
        {step === "success" && (() => {
          const placedOrder = getOrders().find((order) => order.id === orderId);
          return (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4 12 14.01l-3-3" />
              </svg>
            </div>
            <h2 className="heading-2 mt-5">Order placed successfully!</h2>
            <p className="mt-2 text-sm text-text-muted">
              {cashAtStoreSelected ? "Pay at the clinic counter when you collect the order." : codSelected ? "Pay in cash when the order arrives." : "Your payment was received."} Track your order anytime from My Orders.
            </p>
            <div className="mx-auto mt-6 inline-flex flex-col items-center rounded-2xl border border-emerald-200 bg-white px-8 py-5">
              <p className="text-xs uppercase tracking-[0.14em] text-text-muted">
                Order ID
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.1em] text-burgundy">
                {orderId}
              </p>
            </div>
            {placedOrder?.deliveryMode === "store_pickup" ? (
              <div className="mx-auto mt-6 max-w-xl rounded-xl border border-gold/40 bg-warm-cream p-5 text-left text-sm">
                <p className="font-semibold text-text-primary">Pickup from store</p>
                <p className="mt-1 text-text-primary">{pickupLocation.name}</p>
                <p className="mt-1 text-text-muted">{pickupLocation.address}</p>
                {pickupLocation.contactName || pickupLocation.contactPhone ? (
                  <p className="mt-1 text-text-muted">
                    Point of contact: {[pickupLocation.contactName, pickupLocation.contactPhone].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                <p className="mt-1 text-text-muted">Pickup timings: {pickupLocation.hours}</p>
                <a href={pickupLocation.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-burgundy underline">
                  <Glyph name="pin" className="h-3.5 w-3.5" /> Open in Google Maps
                </a>
                {placedOrder.eta ? (
                  <p className="mt-2 font-medium text-emerald-700">
                    Ready {placedOrder.eta}{placedOrder.pickupHoldUntil ? ` · held until ${placedOrder.pickupHoldUntil}` : ""}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-xs text-text-muted">
                {placedEta ? `Estimated delivery: ${placedEta} · ` : ""}
                Live courier tracking on My Orders
              </p>
            )}
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              {orderSettings.gst.invoiceEnabled && (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    const saved = getOrders().find((order) => order.id === orderId);
                    if (saved) printGstInvoice(saved);
                  }}
                >
                  GST invoice
                </button>
              )}
              <Link href="/account/orders" className="btn-primary">
                Track Your Order
              </Link>
              <Link href="/shop" className="btn-outline">
                Continue Shopping
              </Link>
            </div>
          </div>
          );
        })()}
      </div>

      {/* Order summary */}
      {step !== "success" && (
        <aside className="lg:col-span-1 lg:self-start">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
              Price Details
            </h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">Books</dt>
                <dd className="font-medium text-text-primary">{itemCount}</dd>
              </div>
              {totals.discount > 0 ? (<>
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
              </>) : null}
              <div className="flex justify-between">
                <dt className="text-text-muted">Subtotal</dt>
                <dd className="font-medium text-text-primary">
                  {formatPrice(totals.subtotal)}
                </dd>
              </div>
              {orderSettings.gst.enabled && (
                <div className="flex justify-between">
                  <dt className="text-text-muted">GST ({orderSettings.gst.ratePercent}%)</dt>
                  <dd className="font-medium text-text-primary">{formatPrice(totals.gst)}</dd>
                </div>
              )}
              {orderSettings.platformFee.enabled && (
                <div className="flex justify-between">
                  <dt className="text-text-muted">Platform fee{orderSettings.platformFee.refundable ? "" : " (kept on refund)"}</dt>
                  <dd className="font-medium text-text-primary">{formatPrice(totals.platformFee)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-text-muted">
                  Shipping
                </dt>
                <dd className="font-medium text-text-primary">
                  {deliveryMode === "store_pickup"
                    ? "Store pickup · no charge"
                    : hasPreorder
                      ? "Added when you pay the balance"
                      : shipping > 0
                      ? formatPrice(shipping)
                      : shippingIsFree(priced.subtotal, orderSettings)
                        ? "FREE"
                        : "Choose a courier"}
                </dd>
              </div>
              {codFee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-text-muted">Cash on delivery</dt>
                  <dd className="font-medium text-text-primary">{formatPrice(codFee)}</dd>
                </div>
              )}
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