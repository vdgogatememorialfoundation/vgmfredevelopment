import { NextResponse } from "next/server";
import { deliveryInvoiceHtml, issueDeliveryInvoice, issuedInvoice } from "@/lib/server/delivery-invoice";
import { findShopOrderByToken } from "@/lib/server/shop-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Params) {
  const { token } = await context.params;
  const order = findShopOrderByToken(token);
  if (!order) return NextResponse.json({ ok: false, error: "This invoice link is not valid." }, { status: 404 });
  if (order.status === "Delivered" && !issuedInvoice(order.id)) await issueDeliveryInvoice(order.id);
  const invoice = issuedInvoice(order.id);
  if (!invoice) return NextResponse.json({ ok: false, error: "The invoice is issued once the order is delivered." }, { status: 404 });
  return new NextResponse(deliveryInvoiceHtml(order, invoice), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
