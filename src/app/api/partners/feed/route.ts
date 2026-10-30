import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { clientPartnerSnapshot, loadPartnerSnapshot, publicPartnerFeed } from "@/lib/server/partner-portals";

export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const full = request.nextUrl.searchParams.get("full") === "1";
  const snapshot = await loadPartnerSnapshot({ refresh });
  if (full) {
    const denied = denyUnlessPortal(request);
    if (denied) return denied;
    return NextResponse.json(
      {
        ok: true,
        ...clientPartnerSnapshot(snapshot, { includePasswords: true }),
      },
      { headers: { ...corsHeaders, "cache-control": "no-store" } }
    );
  }
  return NextResponse.json(
    { ok: true, ...publicPartnerFeed(snapshot) },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}
