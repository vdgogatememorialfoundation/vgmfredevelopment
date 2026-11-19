import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { ekartLabelPdf } from "@/lib/server/providers";
import { readShippingCreds } from "@/lib/server/shipping-vault";

/** Streams the Ekart label PDF to the desk (Ekart returns raw bytes, not a link). */
export async function GET(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const awb = request.nextUrl.searchParams.get("awb")?.trim() ?? "";
  if (!awb) return NextResponse.json({ ok: false, error: "Tracking id is required." }, { status: 400 });
  const creds = (readShippingCreds().ekart ?? {}) as Record<string, unknown>;
  try {
    const pdf = await ekartLabelPdf(creds, awb);
    if (!pdf) return NextResponse.json({ ok: false, error: "Ekart credentials are not configured." }, { status: 400 });
    return new NextResponse(pdf, {
      headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="ekart-label-${awb.replace(/[^\w-]/g, "")}.pdf"` },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 502 });
  }
}
