import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { lookupPostal } from "@/lib/server/postal-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const postal = request.nextUrl.searchParams.get("postal") || request.nextUrl.searchParams.get("pincode") || "";
  const countryCode = request.nextUrl.searchParams.get("country") || request.nextUrl.searchParams.get("countryCode") || "";
  const place = await lookupPostal({ postal, countryCode });
  return NextResponse.json(
    { ok: Boolean(place), place },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}
