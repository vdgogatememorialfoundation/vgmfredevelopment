import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, readMobileFeed, saveMobileFeed, type MobileFeed } from "@/lib/server/mobile-feed";
import { saveMobileEmailCreds, type MobileEmailCreds } from "@/lib/server/mobile-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublishBody = MobileFeed & { email?: MobileEmailCreds };

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
  if (!body || typeof body !== "object" || !body.site?.name) {
    return NextResponse.json({ ok: false, error: "Send a full app snapshot from the admin console." }, { status: 400, headers: corsHeaders });
  }
  const { email, ...snapshot } = body;
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
