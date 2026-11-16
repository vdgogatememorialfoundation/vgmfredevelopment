import { readFileSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { emailsForOrder, loggedEmail } from "@/lib/server/email-log";
import { dataFile } from "@/lib/server/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readJson<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(dataFile(name), "utf8")) as T;
  } catch {
    return fallback;
  }
}

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
  if (!/^\d{6,20}$/.test(orderId)) return NextResponse.json({ ok: false, error: "Send the order id." }, { status: 400 });
  const logged = emailsForOrder(orderId).map((entry) => ({ ...entry, resendable: Boolean(entry.id && loggedEmail(entry.id)) }));
  const stages = readJson<Record<string, string[]>>("order-stage-mail.json", {})[orderId] ?? [];
  const invoice = readJson<Record<string, { emailedTo?: string; emailedAt?: string }>>("delivery-invoices.json", {})[orderId];
  const earlier: { label: string; at?: string }[] = stages.map((key) => ({ label: stageLabel(key) }));
  if (invoice?.emailedAt && !logged.some((entry) => entry.at <= invoice.emailedAt! && /invoice/i.test(entry.subject))) {
    earlier.push({ label: `Invoice emailed to ${invoice.emailedTo ?? "customer"}`, at: invoice.emailedAt });
  }
  return NextResponse.json({ ok: true, emails: logged, earlier }, { headers: { "cache-control": "no-store" } });
}
