import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, readMobileFeed } from "@/lib/server/mobile-feed";
import { addOrder, attachRazorpayOrder, bearerToken, findOrder, markOrderPaid, sessionFromToken } from "@/lib/server/mobile-store";
import { razorpayCreds, razorpayOrder, razorpayVerify } from "@/lib/server/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

function sessionOf(request: NextRequest, body?: Record<string, unknown> | null) {
  return sessionFromToken(bearerToken(request.headers.get("authorization")) ?? String(body?.token ?? ""));
}

function catalogItems(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0) return { error: "Your bag is empty." as const };
  const books = readMobileFeed().books ?? [];
  const items: { id: string; title: string; quantity: number; price: number }[] = [];
  for (const entry of raw) {
    const row = entry as { id?: string; quantity?: number };
    const id = String(row.id ?? "").trim();
    const book = books.find((item) => String(item.id) === id || String(item.slug) === id);
    if (!book || book.active === false) return { error: "A publication in your bag is not in the published catalogue." as const };
    if (book.stockStatus === "out_of_stock") return { error: `${book.title} is currently out of stock.` as const };
    items.push({
      id: String(book.id),
      title: String(book.title),
      quantity: Math.max(1, Math.min(20, Math.floor(Number(row.quantity) || 1))),
      price: Math.max(0, Number(book.price) || 0),
    });
  }
  return { items };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const session = sessionOf(request, body);
  if (!session) return json({ ok: false, error: "Sign in to checkout." }, 401);

  if (String(body?.action ?? "create") === "verify") {
    const order = findOrder(String(body?.orderId ?? ""), session.email);
    if (!order) return json({ ok: false, error: "That order was not found." }, 404);
    const creds = razorpayCreds({});
    const paymentId = String(body?.paymentId ?? "");
    const razorpayOrderId = String(body?.razorpayOrderId ?? order.razorpayOrderId ?? "");
    const signature = String(body?.signature ?? "");
    if (creds) {
      if (!paymentId || !razorpayOrderId || !signature) return json({ ok: false, error: "Payment details are incomplete." }, 400);
      if (!razorpayVerify(creds.keySecret, razorpayOrderId, paymentId, signature)) {
        return json({ ok: false, error: "Razorpay could not verify this payment." }, 400);
      }
    }
    const paid = markOrderPaid(order.id, {
      paymentId: paymentId || `pay_demo_${Date.now()}`,
      razorpayOrderId,
      method: creds ? "Razorpay" : "Razorpay (demo)",
    });
    return json({ ok: true, order: paid, configured: Boolean(creds) });
  }

  const catalog = catalogItems(body?.items);
  if ("error" in catalog) return json({ ok: false, error: catalog.error }, 400);
  const address = {
    line1: String(body?.line1 ?? "").trim().slice(0, 160),
    city: String(body?.city ?? "").trim().slice(0, 80),
    state: String(body?.state ?? "").trim().slice(0, 80),
    pincode: String(body?.pincode ?? "").trim().slice(0, 12),
  };
  if (!address.line1 || !address.city || !address.state || !/^\d{6}$/.test(address.pincode)) {
    return json({ ok: false, error: "Enter your full delivery address and a 6-digit pincode." }, 400);
  }
  const phone = String(body?.phone ?? "").replace(/\s/g, "");
  if (!/^\+?[0-9]{10,15}$/.test(phone)) {
    return json({ ok: false, error: "Enter a valid mobile number." }, 400);
  }

  const draft = addOrder({
    email: session.email,
    name: (String(body?.name ?? "").trim() || session.name || "Customer").slice(0, 80),
    phone,
    items: catalog.items,
    address,
  });

  const creds = razorpayCreds({});
  if (!creds) {
    return json({
      ok: true,
      configured: false,
      partner: "razorpay",
      order: draft,
      amount: draft.total,
      keyId: "",
      razorpayOrderId: "",
    });
  }

  try {
    const created = await razorpayOrder(creds, draft.total, draft.id);
    const order = attachRazorpayOrder(draft.id, created.orderId) ?? { ...draft, razorpayOrderId: created.orderId };
    return json({
      ok: true,
      configured: true,
      partner: "razorpay",
      order,
      amount: order.total,
      keyId: created.keyId,
      razorpayOrderId: created.orderId,
    });
  } catch (error) {
    return json({ ok: false, error: (error as Error).message || "Razorpay could not start checkout." }, 502);
  }
}
