import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, readMobileFeed, saveMobileFeed, type MobileFeed } from "@/lib/server/mobile-feed";
import { saveMobileEmailCreds, type MobileEmailCreds } from "@/lib/server/mobile-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublishBody = MobileFeed & { email?: MobileEmailCreds; partial?: boolean; force?: boolean; basedOn?: string; sections?: Partial<MobileFeed>; editedBooks?: string[]; removed?: Record<string, string[]> };

/** Items Admin deleted on purpose may empty a list; the collapse guard only stops accidental wipes. */
function onlyRemoved(current: unknown, incoming: unknown, removed?: string[]) {
  if (!Array.isArray(current) || !Array.isArray(incoming) || !removed?.length) return false;
  const kept = new Set(incoming.map((item) => String((item as { id?: unknown })?.id ?? "")));
  return current.every((item) => {
    const id = String((item as { id?: unknown })?.id ?? "");
    return kept.has(id) || removed.includes(id);
  });
}

const SEEDED = new Set(["slide-legacy", "slide-events", "slide-shop"]);

/** A browser that never loaded the live slideshow holds only the built-in slides; those must not replace real banners. */
function seedsOverReal(current: unknown, incoming: unknown, removed?: string[]) {
  if (!Array.isArray(current) || !Array.isArray(incoming) || !incoming.length) return false;
  const id = (item: unknown) => String((item as { id?: unknown })?.id ?? "");
  const real = current.filter((item) => !SEEDED.has(id(item)));
  return real.length > 0 && incoming.every((item) => SEEDED.has(id(item))) && !real.every((item) => removed?.includes(id(item)));
}

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

type FeedPolicies = MobileFeed["policies"];
type PolicyCopy = { updatedAt?: string };

/** Each policy keeps whichever copy was saved last, so an edit from another device is never thrown away. */
function mergePolicies(current: FeedPolicies, incoming: FeedPolicies): FeedPolicies {
  const next = { ...current } as Record<string, unknown>;
  for (const [id, doc] of Object.entries(incoming ?? {})) {
    const mine = (doc as PolicyCopy | undefined)?.updatedAt ?? "";
    const theirs = ((current as Record<string, unknown>)[id] as PolicyCopy | undefined)?.updatedAt ?? "";
    if (mine > theirs) next[id] = doc;
  }
  return next as FeedPolicies;
}

/** Products the sending browser saved go live as sent, stamped with server time so device clocks never decide. */
function withEditedBooks(base: FeedBooks, incoming: FeedBooks, edited: Set<string>): FeedBooks {
  const at = new Date().toISOString();
  const mine = new Map(incoming.filter((book) => edited.has(book.id)).map((book) => [book.id, { ...book, updatedAt: at }]));
  const kept = base.map((book) => mine.get(book.id) ?? book);
  const known = new Set(base.map((book) => book.id));
  return [...Array.from(mine.values()).filter((book) => !known.has(book.id)), ...kept];
}

/** A browser whose local copy never loaded (fresh domain, storage full) sends defaults; a list that collapses in one publish is refused. */
function collapsed(current: unknown, incoming: unknown) {
  if (!Array.isArray(current) || !Array.isArray(incoming)) return false;
  const lost = current.length - incoming.length;
  return current.length > 0 && (incoming.length === 0 || (lost >= 3 && incoming.length < current.length / 2));
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
      const stale = key !== "site" && !(body.removed?.[key]?.length) && (!basedOn || Boolean(changedAt && changedAt > basedOn));
      const removedIds = Array.isArray(body.removed?.[key]) ? body.removed[key].map(String) : undefined;
      const live = (current as Record<string, unknown>)[key];
      if ((collapsed(live, value) && !onlyRemoved(live, value, removedIds)) || (key === "flyers" && seedsOverReal(live, value, removedIds))) {
        rejected.push(key);
        continue;
      }
      // Products merge one by one, so a stock edit is never lost to (or rolled back by) another tab.
      const edited = new Set(Array.isArray(body.editedBooks) ? body.editedBooks.map(String) : []);
      if (key === "books" && edited.size && Array.isArray(value)) {
        const base = stale && Array.isArray(current.books) ? mergeBooks(current.books, value as FeedBooks, basedOn) : (value as FeedBooks);
        sections[key] = withEditedBooks(base, value as FeedBooks, edited);
      } else if (stale && key === "books" && Array.isArray(value) && Array.isArray(current.books)) sections[key] = mergeBooks(current.books, value as FeedBooks, basedOn);
      else if (stale && key === "policies" && value && typeof value === "object") sections[key] = mergePolicies(current.policies ?? {}, value as FeedPolicies);
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
