import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, mergePublishedBrand, readMobileFeed } from "@/lib/server/mobile-feed";

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
      site: feed.site,
      flyers: feed.flyers ?? [],
      publishedAt: feed.publishedAt || null,
    },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    site?: Record<string, string>;
    flyers?: unknown[];
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Send site branding from the admin console." }, { status: 400, headers: corsHeaders });
  }
  const site = body.site && typeof body.site === "object" ? body.site : {};
  const feed = mergePublishedBrand({
    site: {
      name: site.name ? String(site.name) : undefined,
      tagline: site.tagline ? String(site.tagline) : undefined,
      logoUrl: site.logoUrl != null ? String(site.logoUrl) : undefined,
      logoText: site.logoText ? String(site.logoText) : undefined,
      faviconUrl: site.faviconUrl != null ? String(site.faviconUrl) : undefined,
    },
    flyers: Array.isArray(body.flyers) ? (body.flyers as never) : undefined,
  });
  return NextResponse.json(
    { ok: true, publishedAt: feed.publishedAt, site: feed.site, flyers: feed.flyers?.length ?? 0 },
    { headers: corsHeaders }
  );
}
