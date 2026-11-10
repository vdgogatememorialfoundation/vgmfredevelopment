"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { getOrder, recordBalancePayment, recordCourierPayment, recordPayment, recordReturnChargePayment } from "@/lib/admin-store";
import { subscribeCms } from "@/lib/cms";
import { addPreorderShipping, decodeSummary, payWithRazorpay, paymentNotice, waitForRazorpay } from "@/lib/payments-client";
import { formatPrice } from "@/lib/store";

type Summary = { id: string; amount: number; name: string; email: string; phone: string; items: string[]; paid: boolean };

function readSummary(orderId: string, encoded: string | null, courier: boolean, balance = false, returnCharge = false): Summary | null {
  const order = getOrder(orderId);
  if (order && returnCharge && order.returnShipment?.charge) {
    return {
      id: order.id,
      amount: order.returnShipment.charge,
      name: order.deliveryAddress?.fullName ?? "",
      email: order.deliveryAddress?.email ?? "",
      phone: order.deliveryAddress?.phone ?? "",
      items: [`Return courier charge · AWB ${order.returnShipment.awb ?? "pending"}`],
      paid: Boolean(order.returnShipment.chargePaidAt),
    };
  }
  if (order && balance && order.preorderPayment) {
    return {
      id: order.id,
      amount: order.preorderPayment.balance,
      name: order.deliveryAddress?.fullName ?? "",
      email: order.deliveryAddress?.email ?? "",
      phone: order.deliveryAddress?.phone ?? "",
      items: ["Pre-order balance", ...order.items.map((item) => `${item.quantity} × ${item.title}`)],
      paid: Boolean(order.preorderPayment.balancePaidAt),
    };
  }
  if (order && courier && order.courierUpgrade) {
    return {
      id: order.id,
      amount: order.courierUpgrade.amount,
      name: order.deliveryAddress?.fullName ?? "",
      email: order.deliveryAddress?.email ?? "",
      phone: order.deliveryAddress?.phone ?? "",
      items: [`Courier delivery · ${order.courierUpgrade.rate.courierName}`],
      paid: Boolean(order.courierUpgrade.paidAt),
    };
  }
  if (order && !courier && !balance && !returnCharge) {
    return {
      id: order.id,
      amount: order.total,
      name: order.deliveryAddress?.fullName ?? "",
      email: order.deliveryAddress?.email ?? "",
      phone: order.deliveryAddress?.phone ?? "",
      items: order.items.map((item) => `${item.quantity} × ${item.title}`),
      paid: order.paymentStatus === "Paid",
    };
  }
  const decoded = encoded ? decodeSummary(encoded) : null;
  if (!decoded || decoded.id !== orderId) return null;
  return { ...decoded, paid: false };
}

export default function PayClient({ orderId }: { orderId: string }) {
  const params = useSearchParams();
  const expiresAt = Number(params.get("x") || 0);
  const encoded = expiresAt && Date.now() > expiresAt ? null : params.get("d");
  const courier = params.get("part") === "courier";
  const balance = params.get("part") === "balance";
  const returnCharge = params.get("part") === "return";
  const settle = (input: { method: string; reference?: string; razorpayPaymentId?: string }) => {
    if (!getOrder(orderId)) return;
    if (returnCharge) recordReturnChargePayment(orderId, input);
    else if (balance) recordBalancePayment(orderId, input);
    else if (courier) recordCourierPayment(orderId, input);
    else recordPayment(orderId, input);
  };
  const returned = params.get("done") === "1" || params.get("razorpay_payment_link_status") === "paid";
  const ready = useSyncExternalStore(subscribeCms, () => true, () => false);
  const [result, setResult] = useState<{ paymentId: string; demo: boolean } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, setShippingTick] = useState(0);
  const shippingDue = ready && balance && Boolean(getOrder(orderId)?.preorderPayment?.shippingDue);

  useEffect(() => {
    if (!shippingDue) return;
    let alive = true;
    void addPreorderShipping(orderId)
      .catch(() => undefined)
      .then(() => alive && setShippingTick((tick) => tick + 1));
    return () => {
      alive = false;
    };
  }, [shippingDue, orderId]);

  if (!ready) return <main className="container py-20 text-center text-text-muted">Loading payment…</main>;

  if (shippingDue) return <main className="container py-20 text-center text-text-muted">Working out the courier charge…</main>;

  const summary = readSummary(orderId, encoded, courier, balance, returnCharge);

  if (returned || result || summary?.paid) {
    return (
      <main className="container max-w-xl py-16">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <h1 className="heading-2">Payment received</h1>
          <p className="mt-3 text-sm text-text-muted">
            Thank you. Order <span className="font-mono font-semibold text-burgundy">{orderId}</span> {returnCharge ? "return courier charge is paid." : courier ? "will be sent by courier." : "is confirmed."}
            {result?.demo && " (Demo mode: no money was charged.)"}
          </p>
          {result && <p className="mt-2 font-mono text-xs text-text-muted">{result.paymentId}</p>}
          <Link href="/account/orders" className="btn-primary mt-6">View my orders</Link>
        </div>
      </main>
    );
  }

  if (!summary) {
    return (
      <main className="container max-w-xl py-16 text-center">
        <h1 className="heading-2">Payment link not valid</h1>
        <p className="mt-3 text-text-muted">This link is incomplete or has expired. Please ask the Foundation for a new payment link.</p>
        <Link href="/contact" className="btn-outline mt-6">Contact us</Link>
      </main>
    );
  }

  const pay = async () => {
    setBusy(true);
    setError("");
    try {
      const outcome = await payWithRazorpay({
        amount: summary.amount,
        receipt: returnCharge ? `${summary.id}-R` : courier ? `${summary.id}-C` : summary.id,
        name: summary.name,
        email: summary.email,
        phone: summary.phone,
        description: returnCharge ? `Return courier charge for Vaidya Gogate Memorial Foundation order ${summary.id}` : courier ? `Courier charge for Vaidya Gogate Memorial Foundation order ${summary.id}` : `Vaidya Gogate Memorial Foundation order ${summary.id}`,
      });
      if (outcome.kind === "holding") {
        setError("The payment is on hold until Razorpay confirms it. It is not marked paid, and this order is not packed before that.");
        const confirmed = await waitForRazorpay(outcome.razorpayOrderId);
        if (!confirmed) {
          setError("The payment is still on hold until Razorpay confirms it. It is not marked paid. Do not pay again.");
          return;
        }
        settle({ method: "Online", reference: confirmed, razorpayPaymentId: confirmed });
        setResult({ paymentId: confirmed, demo: false });
        setError("");
        return;
      }
      settle({ method: outcome.live ? "Online" : "Online (demo)", reference: outcome.paymentId, razorpayPaymentId: outcome.paymentId });
      setResult({ paymentId: outcome.paymentId, demo: !outcome.live });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Payment did not complete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container max-w-xl py-16">
      <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Vaidya Gogate Memorial Foundation</p>
        <h1 className="heading-2 mt-2">{returnCharge ? "Pay the return courier charge" : courier ? "Pay the courier charge" : "Complete your payment"}</h1>
        <p className="mt-2 text-sm text-text-muted">
          Order <span className="font-mono font-semibold text-text-primary">{summary.id}</span>
          {summary.name ? ` for ${summary.name}` : ""}
        </p>
        <ul className="mt-5 space-y-1 border-y border-border py-4 text-sm text-text-primary">
          {summary.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-text-muted">Amount payable</span>
          <span className="text-2xl font-bold text-burgundy">{formatPrice(summary.amount)}</span>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="button" onClick={pay} disabled={busy} className="btn-primary mt-6 w-full disabled:opacity-60">
          {busy ? "Processing payment…" : `Pay ${formatPrice(summary.amount)}`}
        </button>
        <p className="mt-3 text-center text-xs text-text-muted">
          {paymentNotice() || "UPI, cards and net banking accepted."}
        </p>
      </div>
    </main>
  );
}
