import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, readMobileFeed, saveMobileFeed, type MobileFeed } from "@/lib/server/mobile-feed";
import { saveMobileEmailCreds, type MobileEmailCreds } from "@/lib/server/mobile-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublishBody = MobileFeed & { email?: MobileEmailCreds; partial?: boolean; force?: boolean; basedOn?: string; sections?: Partial<MobileFeed> };

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

type FeedBooks = NonNullable<MobileFeed["books"]>;

function mergeBooks(current: FeedBooks, incoming: FeedBooks, basedOn: string): FeedBooks {
  const mine = new Map(incoming.map((book) => [book.id, book]));
  const kept = current.map((book) => {
    const edit = mine.get(book.id);
    return edit && (edit.updatedAt ?? "") > (book.updatedAt ?? "") ? edit : book;
  });
  const known = new Set(current.map((book) => book.id));
  const added = incoming.filter((book) => !known.has(book.id) && (book.updatedAt ?? "") > basedOn);
  return [...added, ...kept];
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as PublishBody | null;
  if (body?.partial && body.sections && typeof body.sections === "object") {
    const current = readMobileFeed();
    const { publishedAt: _ignored, sectionAt: _stamps, ...incoming } = body.sections;
    void _ignored;
    void _stamps;
    const basedOn = typeof body.basedOn === "string" ? body.basedOn : "";
    const rejected: string[] = [];
    const sections: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(incoming)) {
      // A section changed on another device after this browser loaded the live site is kept, not overwritten.
      const changedAt = current.sectionAt?.[key] || current.publishedAt || "";
      const stale = key !== "site" && (!basedOn || Boolean(changedAt && changedAt > basedOn));
      // Products merge one by one, so a stock edit is never lost to (or rolled back by) another tab.
      if (stale && key === "books" && Array.isArray(value) && Array.isArray(current.books)) sections[key] = mergeBooks(current.books, value as FeedBooks, basedOn);
      else if (stale) rejected.push(key);
      else sections[key] = value;
    }
    if (body.email) saveMobileEmailCreds(body.email);
    if (!Object.keys(sections).length) {
      return NextResponse.json(
        {
          ok: false,
          rejected,
          error: "Another device updated this content after this page loaded. Hard-reload admin to get the latest copy, then edit again.",
        },
        { status: 409, headers: corsHeaders }
      );
    }
    const publishedAt = new Date().toISOString();
    const feed = saveMobileFeed({
      ...current,
      ...(sections as Partial<MobileFeed>),
      site: { ...current.site, ...(sections.site as Partial<MobileFeed["site"]> | undefined) },
      sectionAt: { ...current.sectionAt, ...Object.fromEntries(Object.keys(sections).map((key) => [key, publishedAt])) },
      publishedAt,
    });
    return NextResponse.json(
      {
        ok: true,
        publishedAt: feed.publishedAt,
        previousAt: current.publishedAt || "",
        rejected,
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
  const forcedAt = new Date().toISOString();
  const feed = saveMobileFeed({
    ...snapshot,
    sectionAt: Object.fromEntries(Object.keys(snapshot).map((key) => [key, forcedAt])),
    publishedAt: forcedAt,
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
