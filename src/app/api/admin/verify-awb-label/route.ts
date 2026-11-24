import { NextRequest, NextResponse } from "next/server";
import { verifyAwbLabelImage } from "@/lib/server/awb-verify";
import { findShopOrder, patchShopOrder } from "@/lib/server/shop-orders";
import { findShopShipment } from "@/lib/server/shop-shipments";
import { storeUploadedFile } from "@/lib/server/media-upload";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import type { Order } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const viewer = commerceViewer(request);
  if (!viewer.portal) {
    return NextResponse.json({ ok: false, error: "Sign in to Admin / Staff portal first." }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "Invalid upload payload." }, { status: 400 });
  const file = form.get("file");
  const orderId = String(form.get("orderId") ?? "").trim();
  const byName = String(form.get("byName") ?? viewer.email ?? "Admin").trim();
  const byEmail = String(form.get("byEmail") ?? viewer.email ?? "admin").trim();
  if (!(file instanceof File) || !orderId) {
    return NextResponse.json({ ok: false, error: "Order ID and label photo file are required." }, { status: 400 });
  }
  const order = findShopOrder(orderId);
  if (!order) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  const shipment = findShopShipment(orderId);
  const allottedAwb = String(shipment?.awb || order.trackingId || "").trim();
  const norm = (v?: string) => String(v || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const expectedKey = norm(allottedAwb);
  if (!expectedKey) {
    return NextResponse.json({ ok: false, error: "No courier AWB allotted to this order yet. Book a courier first." }, { status: 400 });
  }
  const alreadyUploaded = (order.awbPhotos ?? []).some(
    (p) => (shipment?.id && p.shipmentId === shipment.id) || norm(p.awb) === expectedKey
  );
  if (alreadyUploaded) {
    return NextResponse.json(
      { ok: false, error: `AWB label image already uploaded for ${shipment?.courier || order.courierName || "this courier"} (AWB ${allottedAwb}). Delete it first or reassign courier.` },
      { status: 409 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "Photo must be under 10 MB." }, { status: 400 });
  }
  const mime = file.type || "image/jpeg";
  const ext = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";

  // Automatically read barcode + OCR text from the label photo and verify against allotted AWB!
  const check = await verifyAwbLabelImage(bytes, ext, allottedAwb, orderId);
  if (!check.matched) {
    const seenCodes = check.barcodes.length ? ` Detected barcodes: ${check.barcodes.join(", ")}.` : "";
    return NextResponse.json(
      {
        ok: false,
        verified: false,
        error: `Auto-verification failed: Label photo does not contain the courier-allotted AWB "${allottedAwb}".${seenCodes} Please capture a clear, straight photo of the correct shipping label.`,
        detectedBarcodes: check.barcodes,
        ocrSnippet: check.snippet,
      },
      { status: 422 }
    );
  }

  const stored = await storeUploadedFile(file);
  const at = new Date().toISOString();
  const courierName = shipment?.courier || order.courierName || undefined;
  const entry = {
    url: stored.url,
    at,
    by: byEmail,
    byName,
    awb: allottedAwb,
    courier: courierName,
    shipmentId: shipment?.id || undefined,
  };
  const nextPhotos = [...(order.awbPhotos ?? []), entry];
  const updated = patchShopOrder(orderId, {
    awbPhotos: nextPhotos,
    history: [
      ...(order.history ?? []),
      { at, status: order.status, by: byName, note: `AWB label auto-verified via ${check.method} & uploaded (${courierName ? `${courierName} · ` : ""}AWB ${allottedAwb})` },
    ],
  } as Partial<Order>);

  return NextResponse.json({
    ok: true,
    verified: true,
    method: check.method,
    photo: entry,
    order: updated,
    message: `AWB ${allottedAwb} auto-verified from label photo (${check.method}) and saved!`,
  });
}
