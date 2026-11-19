import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { goswiftLabelPdf } from "@/lib/server/providers";
import { readShippingCreds } from "@/lib/server/shipping-vault";

/** Streams the GoSwift label PDF to the desk (GoSwift returns raw bytes, not a link). */
export async function GET(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const awb = request.nextUrl.searchParams.get("awb")?.trim() ?? "";
  if (!awb) return NextResponse.json({ ok: false, error: "Tracking id is required." }, { status: 400 });
  const creds = (readShippingCreds().goswift ?? {}) as Record<string, unknown>;
  try {
    const pdf = await goswiftLabelPdf(creds, awb);
    if (!pdf) return NextResponse.json({ ok: false, error: "GoSwift credentials are not configured." }, { status: 400 });
    return new NextResponse(pdf, {
      headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="goswift-label-${awb.replace(/[^\w-]/g, "")}.pdf"` },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 502 });
  }
}
