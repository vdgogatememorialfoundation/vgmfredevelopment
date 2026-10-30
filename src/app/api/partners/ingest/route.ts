import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { ingestPartnerPayload } from "@/lib/server/partner-portals";

export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await ingestPartnerPayload(request, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers: corsHeaders });
  }
  return NextResponse.json({ ok: true, portal: result.portal, syncedAt: result.syncedAt }, { headers: corsHeaders });
}
