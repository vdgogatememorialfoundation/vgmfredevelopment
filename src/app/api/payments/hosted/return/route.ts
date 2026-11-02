import { NextRequest, NextResponse } from "next/server";
import type { HostedGatewayId } from "@/lib/integrations";
import { verifyHostedReturn } from "@/lib/server/hosted-payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IDS = new Set<HostedGatewayId>(["payu", "easebuzz", "cashfree", "phonepe"]);

async function finish(request: NextRequest, fields: Record<string, string>) {
  const gateway = (request.nextUrl.searchParams.get("gateway") || fields.gateway || "") as HostedGatewayId;
  const safe = IDS.has(gateway) ? gateway : "payu";
  const result = IDS.has(gateway) ? await verifyHostedReturn(gateway, fields).catch(() => ({ ok: false, orderId: "", paymentId: "" })) : { ok: false, orderId: "", paymentId: "" };
  const url = new URL("/checkout", request.url);
  url.searchParams.set("payment", result.ok ? "paid" : "failed");
  url.searchParams.set("gateway", safe);
  if (result.orderId) url.searchParams.set("orderId", result.orderId);
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
