import { NextRequest, NextResponse } from "next/server";
import type { HostedGatewayId, HostedGatewaySettings } from "@/lib/integrations";
import { PaymentError, startHostedPayment } from "@/lib/server/hosted-payments";
import { listReadyGateways, writePaymentVault, type PaymentVault } from "@/lib/server/payment-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IDS = new Set<HostedGatewayId>(["payu", "easebuzz", "cashfree", "phonepe"]);

function adminCookie(request: NextRequest) {
  const raw = request.cookies.get("vgmf_admin_session")?.value || "";
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    /* already decoded */
  }
  for (const value of candidates) {
    try {
      const parsed = JSON.parse(value) as { role?: string };
      if (parsed.role === "admin" || parsed.role === "coadmin" || parsed.role === "staff") return true;
    } catch {
      /* next */
    }
  }
  return false;
}

function cleanGateway(value: unknown): HostedGatewaySettings | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<HostedGatewaySettings>;
  return {
    enabled: Boolean(row.enabled),
    mode: row.mode === "live" ? "live" : "test",
    key: String(row.key ?? "").trim(),
    salt: String(row.salt ?? "").trim(),
    merchantId: String(row.merchantId ?? "").trim(),
    saltIndex: String(row.saltIndex ?? "1").trim() || "1",
  };
}

export async function GET() {
  return NextResponse.json({ ok: true, gateways: listReadyGateways() });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.action === "save") {
    if (!adminCookie(request)) return NextResponse.json({ ok: false, error: "Sign in to the admin desk to save payment keys." }, { status: 401 });
    const incoming = (body.payments && typeof body.payments === "object" ? body.payments : {}) as Record<string, unknown>;
    const next: PaymentVault = {};
    for (const id of IDS) {
      const cleaned = cleanGateway(incoming[id]);
      if (cleaned) next[id] = cleaned;
    }
    writePaymentVault(next);
    return NextResponse.json({ ok: true, gateways: listReadyGateways() });
  }
  const gateway = String(body.gateway || "") as HostedGatewayId;
  if (!IDS.has(gateway)) return NextResponse.json({ ok: false, error: "Choose a payment method." }, { status: 400 });
  try {
    const origin = request.nextUrl.origin;
    const started = await startHostedPayment({
      gateway,
      amount: Number(body.amount),
      orderId: String(body.orderId || ""),
      name: String(body.name || "Customer"),
      email: String(body.email || ""),
      phone: String(body.phone || ""),
      product: String(body.product || "Foundation shop order"),
      returnUrl: `${origin}/api/payments/hosted/return?gateway=${gateway}`,
    });
    return NextResponse.json({ ok: true, ...started });
  } catch (error) {
    const message = error instanceof PaymentError ? error.message : "The payment gateway did not answer.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
