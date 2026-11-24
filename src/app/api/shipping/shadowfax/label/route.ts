import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { shadowfaxLabelUrl } from "@/lib/server/providers";
import { readShippingCreds } from "@/lib/server/shipping-vault";

/** Shadowfax issues a short-lived label link; ask for a fresh one each time and send the desk there. */
export async function GET(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const awb = request.nextUrl.searchParams.get("awb")?.trim() ?? "";
  if (!awb) return NextResponse.json({ ok: false, error: "Tracking id is required." }, { status: 400 });
  const creds = (readShippingCreds().shadowfax ?? {}) as Record<string, unknown>;
  try {
    const url = await shadowfaxLabelUrl(creds, awb);
    if (!url) return NextResponse.json({ ok: false, error: "Shadowfax API token is not configured." }, { status: 400 });
    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 502 });
  }
}
