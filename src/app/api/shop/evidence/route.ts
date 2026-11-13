import { NextRequest, NextResponse } from "next/server";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { storeUploadedFile } from "@/lib/server/media-upload";
import { findShopOrder, orderPhoneMatches, ordersForAccount } from "@/lib/server/shop-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Photos and unboxing videos a customer attaches to a return or replacement request on their own order. */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const orderId = String(form?.get("orderId") ?? "");
  const phone = String(form?.get("phone") ?? "");
  const order = orderId ? findShopOrder(orderId) : undefined;
  const viewer = commerceViewer(request);
  const owns = Boolean(
    order &&
      (viewer.portal ||
        ((viewer.email || viewer.phone || viewer.id) && ordersForAccount(viewer).some((item) => item.id === orderId)) ||
        (phone && orderPhoneMatches(order, phone)))
  );
  if (!owns) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  if (!(file instanceof File) || !file.size) return NextResponse.json({ ok: false, error: "Choose a file to upload." }, { status: 400 });
  if (!/^(image|video)\//.test(file.type)) return NextResponse.json({ ok: false, error: "Upload a photo or a video." }, { status: 400 });
  try {
    const stored = await storeUploadedFile(file);
    return NextResponse.json({ ok: true, url: stored.url });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}
