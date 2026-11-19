import { NextResponse, type NextRequest } from "next/server";
import { commerceViewer } from "@/lib/server/commerce-viewer";
import { corsHeaders, publicFeed, readMobileFeed } from "@/lib/server/mobile-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const full = readMobileFeed();
  const feed = commerceViewer(request).portal ? full : publicFeed(full);
  return NextResponse.json(
    {
      ok: true,
      feed,
    },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}
