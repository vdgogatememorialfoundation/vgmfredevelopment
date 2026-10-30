import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { liveApplicationById, liveStatusCatalogs } from "@/lib/server/partner-portals";

export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const id = (request.nextUrl.searchParams.get("id") ?? request.nextUrl.searchParams.get("applicationId") ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: true, found: false, ticket: null }, { headers: { ...corsHeaders, "cache-control": "no-store" } });
  }
  const [match, statuses] = await Promise.all([liveApplicationById(id), liveStatusCatalogs()]);
  return NextResponse.json(
    {
      ok: true,
      found: Boolean(match),
      ticket: match?.ticket ?? null,
      email: match?.email ?? null,
      statuses,
    },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}
