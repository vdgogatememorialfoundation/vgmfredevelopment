import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { defaultAppearance, publicAppearancePayload, sanitizeAppearance } from "@/lib/mobile-appearance";
import { corsHeaders, readMobileFeed } from "@/lib/server/mobile-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const feed = readMobileFeed();
  const appearance = publicAppearancePayload(sanitizeAppearance(feed.appearance ?? defaultAppearance));
  const body = {
    ok: true,
    version: appearance.version,
    publishedAt: appearance.publishedAt || feed.publishedAt || "",
    appearance,
    mobile: {
      modules: feed.mobile?.modules ?? {},
      apps: {
        customer: { name: feed.mobile?.apps?.customer?.name ?? "", logoUrl: feed.mobile?.apps?.customer?.logoUrl ?? "" },
        admin: { name: feed.mobile?.apps?.admin?.name ?? "", logoUrl: feed.mobile?.apps?.admin?.logoUrl ?? "" },
        staff: { name: feed.mobile?.apps?.staff?.name ?? "", logoUrl: feed.mobile?.apps?.staff?.logoUrl ?? "" },
        support: { name: feed.mobile?.apps?.support?.name ?? "", logoUrl: feed.mobile?.apps?.support?.logoUrl ?? "" },
      },
    },
    site: {
      name: feed.site?.name ?? "",
      tagline: feed.site?.tagline ?? "",
      logoUrl: feed.site?.logoUrl ?? "",
    },
  };
  const etag = `"${createHash("sha1").update(JSON.stringify(body)).digest("hex")}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ...corsHeaders, etag, "cache-control": "no-store" },
    });
  }
  return NextResponse.json(body, {
    headers: { ...corsHeaders, etag, "cache-control": "no-store" },
  });
}
