import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import {
  createInvoice,
  deleteInvoice,
  emailInvoice,
  findInvoice,
  invoiceHtml,
  listInvoices,
  readInvoiceSettings,
  saveInvoiceSettings,
  updateInvoice,
  type InvoiceKind,
} from "@/lib/server/delivery-invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

export function GET(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const view = request.nextUrl.searchParams.get("view");
  if (view) {
    const invoice = findInvoice(view);
    if (!invoice) return new NextResponse("Invoice not found.", { status: 404 });
    return new NextResponse(invoiceHtml(invoice), { headers: { "content-type": "text/html; charset=utf-8", ...noStore } });
  }
  return NextResponse.json({ ok: true, invoices: listInvoices(), settings: readInvoiceSettings() }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (body.action) {
      case "settings":
        return NextResponse.json({ ok: true, settings: saveInvoiceSettings((body.settings ?? {}) as Record<string, never>) }, { headers: noStore });
      case "create": {
        const kind = (["order", "platform-fee", "custom"].includes(String(body.kind)) ? body.kind : "order") as InvoiceKind;
        const invoice = createInvoice({ ...((body.invoice ?? {}) as object), kind, orderId: String(body.orderId ?? "") });
        return NextResponse.json({ ok: true, invoice }, { headers: noStore });
      }
      case "update":
        return NextResponse.json({ ok: true, invoice: updateInvoice(String(body.key ?? ""), (body.invoice ?? {}) as object) }, { headers: noStore });
      case "email":
        return NextResponse.json({ ok: true, invoice: await emailInvoice(String(body.key ?? ""), String(body.to ?? "")) }, { headers: noStore });
      case "delete":
        deleteInvoice(String(body.key ?? ""));
        return NextResponse.json({ ok: true }, { headers: noStore });
      default:
        return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}
