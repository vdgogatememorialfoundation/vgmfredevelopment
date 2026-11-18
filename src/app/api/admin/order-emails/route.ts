import { readFileSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { emailsForOrder, loggedEmail } from "@/lib/server/email-log";
import { dataFile } from "@/lib/server/paths";
import { resendWhatsAppStage } from "@/lib/server/order-stage-mail";
import { findShopOrder } from "@/lib/server/shop-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readJson<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(dataFile(name), "utf8")) as T;
  } catch {
    return fallback;
  }
}

const ORDER_ID = /^[a-z0-9]{6,20}(-\d{1,2})?$/i;

function stageLabel(key: string) {
  if (key === "placed") return "Order placed";
  if (key.startsWith("status:")) return `Order ${key.slice(7).toLowerCase()}`;
  return key.replace(/[-_:]+/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

/** Every email sent about one order, newest first, plus stage emails sent before the email log existed. */
export async function GET(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const orderId = String(request.nextUrl.searchParams.get("orderId") ?? "").trim();
  if (!ORDER_ID.test(orderId)) return NextResponse.json({ ok: false, error: "Send the order id." }, { status: 400 });
  const logged = emailsForOrder(orderId).map((entry) => ({ ...entry, resendable: Boolean(entry.id && loggedEmail(entry.id)) }));
  const stages = readJson<Record<string, string[]>>("order-stage-mail.json", {})[orderId] ?? [];
  const invoice = readJson<Record<string, { emailedTo?: string; emailedAt?: string }>>("delivery-invoices.json", {})[orderId];
  const earlier: { label: string; at?: string }[] = stages.map((key) => ({ label: stageLabel(key) }));
  if (invoice?.emailedAt && !logged.some((entry) => entry.at <= invoice.emailedAt! && /invoice/i.test(entry.subject))) {
    earlier.push({ label: `Invoice emailed to ${invoice.emailedTo ?? "customer"}`, at: invoice.emailedAt });
  }
  const current = findShopOrder(orderId)?.status;
  const keys = [...new Set(["placed", ...stages.filter((key) => key !== "placed"), ...(current ? [`status:${current}`] : [])])];
  const whatsapp = keys.filter((key) => key === "placed" || key.startsWith("status:") || key.startsWith("return:")).map((key) => ({ key, label: stageLabel(key) }));
  return NextResponse.json({ ok: true, emails: logged, earlier, whatsapp }, { headers: { "cache-control": "no-store" } });
}

/** Resend one stage's WhatsApp update for an order. */
export async function POST(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { orderId?: string; key?: string } | null;
  const orderId = String(body?.orderId ?? "").trim();
  const key = String(body?.key ?? "").trim().slice(0, 80);
  if (!ORDER_ID.test(orderId) || !key) return NextResponse.json({ ok: false, error: "Send the order id and stage." }, { status: 400 });
  try {
    const sent = await resendWhatsAppStage(orderId, key);
    return NextResponse.json(sent ? { ok: true } : { ok: false, error: "Not sent. Check Settings → WhatsApp: a provider must be ticked and a template mapped for this alert." });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message });
  }
}
