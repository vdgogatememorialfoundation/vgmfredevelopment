import { NextRequest, NextResponse } from "next/server";
import type { HostedGatewayId } from "@/lib/integrations";
import { pollHostedPayment, verifyHostedReturn } from "@/lib/server/hosted-payments";
import { readHold, saveHold } from "@/lib/server/payment-holds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IDS = new Set<HostedGatewayId>(["payu", "easebuzz", "cashfree", "phonepe"]);

async function finish(request: NextRequest, fields: Record<string, string>) {
  const gateway = (request.nextUrl.searchParams.get("gateway") || fields.gateway || "") as HostedGatewayId;
  const safe = IDS.has(gateway) ? gateway : "payu";
  const result = IDS.has(gateway) ? await verifyHostedReturn(gateway, fields).catch(() => ({ ok: false, orderId: "", paymentId: "" })) : { ok: false, orderId: "", paymentId: "" };
  const orderId = result.orderId || fields.txnid || fields.order_id || fields.orderId || "";
  let outcome: "paid" | "failed" | "holding" = result.ok ? "paid" : "failed";
  if (!result.ok && IDS.has(gateway) && orderId) {
    const polled = await pollHostedPayment(gateway, orderId);
    outcome = polled === "confirmed" ? "paid" : polled === "failed" ? "failed" : "holding";
  }
  if (orderId && IDS.has(gateway)) {
    const now = new Date().toISOString();
    const existing = readHold(orderId);
    saveHold({
      id: orderId,
      kind: existing?.kind || "order",
      gateway,
      amount: existing?.amount || Number(fields.amount || 0),
      status: outcome === "paid" ? "confirmed" : outcome === "failed" ? "failed" : "holding",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      reference: result.paymentId || existing?.reference,
    });
  }
  const url = new URL("/checkout", request.url);
  url.searchParams.set("payment", outcome);
  url.searchParams.set("gateway", safe);
  if (orderId) url.searchParams.set("orderId", orderId);
  if (result.paymentId) url.searchParams.set("ref", result.paymentId);
  return NextResponse.redirect(url, 303);
}

export async function GET(request: NextRequest) {
  const fields = Object.fromEntries(request.nextUrl.searchParams.entries());
  return finish(request, fields);
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const fields: Record<string, string> = {};
  form?.forEach((value, key) => {
    fields[key] = String(value);
  });
  return finish(request, fields);
}
