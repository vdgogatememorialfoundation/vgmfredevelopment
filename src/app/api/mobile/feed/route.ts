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
      hint: "The Android/iOS apps load this feed on launch. Publish from Admin → Mobile app after you change content — no Play Store or App Store release is required.",
    },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}
