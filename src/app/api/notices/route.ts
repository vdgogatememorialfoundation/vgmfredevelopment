import { NextRequest, NextResponse } from "next/server";
import { asBoolean, fileFromForm, listNotices, publicNotice, queryNotices, upsertNotice } from "@/lib/server/notices";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const category = request.nextUrl.searchParams.get("category") ?? "";
  const kind = request.nextUrl.searchParams.get("kind") ?? "";
  const year = request.nextUrl.searchParams.get("year") ?? "";
  const notices = q || category || kind || year ? queryNotices({ q, category, kind, year }) : listNotices();
  return NextResponse.json({
    ok: true,
    notices: notices.map(publicNotice),
  });
}

export async function POST(request: NextRequest) {
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
    });
    return NextResponse.json({ ok: true, notice: publicNotice(notice) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}
