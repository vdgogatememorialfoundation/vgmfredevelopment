import { NextRequest, NextResponse } from "next/server";
import { asBoolean, fileFromForm, listNotices, publicNotice, queryNotices, scheduleFromForm, upsertNotice } from "@/lib/server/notices";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { denyUnlessPortal } from "@/lib/server/portal-auth";

export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const category = request.nextUrl.searchParams.get("category") ?? "";
  const kind = request.nextUrl.searchParams.get("kind") ?? "";
  const year = request.nextUrl.searchParams.get("year") ?? "";
  const includeScheduled = request.nextUrl.searchParams.get("scheduled") === "1";
  if (includeScheduled) {
    const denied = denyUnlessPortal(request);
    if (denied) return denied;
  }
  const notices =
    q || category || kind || year
      ? queryNotices({ q, category, kind, year, includeScheduled })
      : listNotices({ includeScheduled });
  return NextResponse.json(
    {
      ok: true,
      notices: notices.map(publicNotice),
    },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const title = String(form.get("title") ?? "").trim();
      if (!title) return NextResponse.json({ ok: false, error: "Add a title." }, { status: 400 });
      const uploaded = await fileFromForm(form);
      const clearFile = asBoolean(form.get("clearFile"));
      const notice = upsertNotice({
        id: String(form.get("id") ?? "") || undefined,
        title,
        description: String(form.get("description") ?? form.get("body") ?? ""),
        category: String(form.get("category") ?? "Notice"),
        date: String(form.get("date") ?? ""),
        href: String(form.get("href") ?? ""),
        pinned: asBoolean(form.get("pinned")),
        ...scheduleFromForm(form),
        ...(clearFile && !uploaded.attachment ? { attachment: "", fileName: "", fileType: "" } : uploaded),
      });
      return NextResponse.json({ ok: true, notice: publicNotice(notice) });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ ok: false, error: "Add a title." }, { status: 400 });
    const notice = upsertNotice({
      id: typeof body.id === "string" ? body.id : undefined,
      title,
      description: String(body.description ?? body.body ?? ""),
      category: String(body.category ?? "Notice"),
      date: String(body.date ?? ""),
      href: String(body.href ?? ""),
      attachment: typeof body.attachment === "string" ? body.attachment : undefined,
      fileName: typeof body.fileName === "string" ? body.fileName : undefined,
      fileType: typeof body.fileType === "string" ? body.fileType : undefined,
      pinned: Boolean(body.pinned),
      publishAt: typeof body.publishAt === "string" ? body.publishAt : undefined,
      unpublishAt: typeof body.unpublishAt === "string" ? body.unpublishAt : undefined,
    });
    return NextResponse.json({ ok: true, notice: publicNotice(notice) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}
