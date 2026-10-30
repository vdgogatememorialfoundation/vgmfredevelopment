import { NextResponse } from "next/server";
import { corsHeaders, readMobileFeed } from "@/lib/server/mobile-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const feed = readMobileFeed();
  return NextResponse.json(
    {
      ok: true,
      feed,
    },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}
