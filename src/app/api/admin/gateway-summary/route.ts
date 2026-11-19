import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { razorpayCreds, razorpayList } from "@/lib/server/providers";
import { deletedShopOrderIds, listShopOrders } from "@/lib/server/shop-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const round = (value: number) => Math.round(value * 100) / 100;

/** Gateway totals for a period, worked out the way the Razorpay dashboard does, next to what the orders recorded. */
export async function GET(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const days = Math.min(90, Math.max(1, Math.floor(Number(request.nextUrl.searchParams.get("days")) || 7)));
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;
  const orders = listShopOrders();
  const known = new Set<string>();
  for (const order of orders) for (const match of JSON.stringify(order).matchAll(/pay_[A-Za-z0-9]+/g)) known.add(match[0]);
  const deleted = new Set(deletedShopOrderIds());

  const orderRefunds = { toBank: 0, toStoreCredit: 0, count: 0 };
  for (const order of orders) {
    for (const refund of order.refunds ?? []) {
      const at = Date.parse(refund.at) / 1000;
      if (!(at >= from && at <= to) || refund.status === "failed") continue;
      orderRefunds.count += 1;
      if (refund.destination === "store_credit") orderRefunds.toStoreCredit += refund.amount;
      else orderRefunds.toBank += refund.amount;
    }
  }

  const creds = razorpayCreds({});
  if (!creds) return NextResponse.json({ ok: true, days, gateway: null, orderRefunds }, { headers: { "cache-control": "no-store" } });
  try {
    const [payments, refunds] = await Promise.all([razorpayList(creds, "payments", from, to), razorpayList(creds, "refunds", from, to)]);
    const rupee = (paise: unknown) => Number(paise ?? 0) / 100;
    // Razorpay's "Collected Amount" counts captured payments; fully refunded ones drop out of it.
    const captured = payments.filter((payment) => payment.status === "captured");
    const fullyRefunded = payments.filter((payment) => payment.status === "refunded");
    const unmatched = [...captured, ...fullyRefunded]
      .filter((payment) => !known.has(String(payment.id)))
      .map((payment) => {
        const orderId = String(payment.description ?? "").match(/\b\d{12}\b/)?.[0] ?? "";
        return {
          id: String(payment.id),
          amount: rupee(payment.amount),
          refunded: rupee(payment.amount_refunded),
          status: String(payment.status),
          at: new Date(Number(payment.created_at) * 1000).toISOString(),
          orderId,
          orderDeleted: Boolean(orderId && deleted.has(orderId)),
        };
      });
    const collected = captured.reduce((sum, payment) => sum + rupee(payment.amount), 0);
    const notOnOrders = unmatched.filter((payment) => payment.status === "captured").reduce((sum, payment) => sum + payment.amount, 0);
    return NextResponse.json(
      {
        ok: true,
        days,
        gateway: {
          name: "Razorpay",
          collected: round(collected),
          count: captured.length,
          onOrders: round(collected - notOnOrders),
          notOnOrders: round(notOnOrders),
          fullyRefunded: { count: fullyRefunded.length, amount: round(fullyRefunded.reduce((sum, payment) => sum + rupee(payment.amount), 0)) },
          refunded: round(refunds.reduce((sum, refund) => sum + rupee(refund.amount), 0)),
          refundCount: refunds.length,
        },
        orderRefunds: { ...orderRefunds, toBank: round(orderRefunds.toBank), toStoreCredit: round(orderRefunds.toStoreCredit) },
        unmatched,
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, days, error: error instanceof Error ? error.message : "Razorpay did not answer.", orderRefunds },
      { headers: { "cache-control": "no-store" } }
    );
  }
}
