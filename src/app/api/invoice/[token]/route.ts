import { NextResponse } from "next/server";
import { findInvoiceByToken, invoiceHtml } from "@/lib/server/delivery-invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Params) {
  const { token } = await context.params;
  const invoice = token ? findInvoiceByToken(token) : undefined;
  if (!invoice) return NextResponse.json({ ok: false, error: "This invoice link is not valid." }, { status: 404 });
  return new NextResponse(invoiceHtml(invoice), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
