import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, readMobileFeed, saveMobileFeed, type MobileFeed } from "@/lib/server/mobile-feed";
import { saveMobileEmailCreds, type MobileEmailCreds } from "@/lib/server/mobile-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublishBody = MobileFeed & { email?: MobileEmailCreds; partial?: boolean; force?: boolean; sections?: Partial<MobileFeed> };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const feed = readMobileFeed();
  return NextResponse.json(
    { ok: true, publishedAt: feed.publishedAt || null },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as PublishBody | null;
  if (body?.partial && body.sections && typeof body.sections === "object") {
    const current = readMobileFeed();
    const { publishedAt: _ignored, ...sections } = body.sections;
    void _ignored;
    if (body.email) saveMobileEmailCreds(body.email);
    const feed = saveMobileFeed({
      ...current,
      ...sections,
      site: { ...current.site, ...sections.site },
      publishedAt: new Date().toISOString(),
    });
    return NextResponse.json(
      {
        ok: true,
        publishedAt: feed.publishedAt,
        sections: Object.keys(sections),
        counts: { events: feed.events?.length ?? 0, articles: feed.articles?.length ?? 0, books: feed.books?.length ?? 0 },
      },
      { headers: corsHeaders }
    );
  }
  // Whole-site snapshots came from admin tabs running an older build and could roll live content back.
  if (!body?.force) {
    return NextResponse.json(
      { ok: false, error: "This admin tab is running an older version. Hard-reload it once, then publish again." },
      { status: 409, headers: corsHeaders }
    );
  }
  if (!body.site?.name) {
    return NextResponse.json({ ok: false, error: "Send a full app snapshot from the admin console." }, { status: 400, headers: corsHeaders });
  }
  const { email, force: _force, ...snapshot } = body;
  void _force;
  saveMobileEmailCreds(email);
  const feed = saveMobileFeed({
    ...snapshot,
    publishedAt: new Date().toISOString(),
  });
  return NextResponse.json(
    {
      ok: true,
      publishedAt: feed.publishedAt,
      counts: {
        events: feed.events?.length ?? 0,
        articles: feed.articles?.length ?? 0,
        books: feed.books?.length ?? 0,
        clinics: feed.clinics?.length ?? 0,
        videos: feed.videos?.length ?? 0,
        notices: feed.notices?.length ?? 0,
        gallery: feed.gallery?.length ?? 0,
      },
    },
    { headers: corsHeaders }
  );
}
