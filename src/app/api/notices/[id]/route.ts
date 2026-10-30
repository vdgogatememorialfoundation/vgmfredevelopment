import { NextRequest, NextResponse } from "next/server";
import { asBoolean, fileFromForm, getNotice, publicNotice, removeNotice, scheduleFromForm, upsertNotice } from "@/lib/server/notices";
import { denyUnlessPortal } from "@/lib/server/portal-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Params) {
  const { id } = await context.params;
  const notice = getNotice(id);
  if (!notice) return NextResponse.json({ ok: false, error: "Notice not found." }, { status: 404 });
  return NextResponse.json({ ok: true, notice: publicNotice(notice) });
}

export async function PATCH(request: NextRequest, context: Params) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const { id } = await context.params;
  const existing = getNotice(id);
  if (!existing) return NextResponse.json({ ok: false, error: "Notice not found." }, { status: 404 });

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const uploaded = await fileFromForm(form);
      const clearFile = asBoolean(form.get("clearFile"));
      const title = String(form.get("title") ?? existing.title).trim();
      const notice = upsertNotice({
        ...existing,
        id,
        title,
        description: String(form.get("description") ?? form.get("body") ?? existing.description),
        category: String(form.get("category") ?? existing.category),
        date: String(form.get("date") ?? existing.date),
        href: String(form.get("href") ?? existing.href),
        pinned: form.has("pinned") ? asBoolean(form.get("pinned")) : existing.pinned,
        ...scheduleFromForm(form),
        ...(clearFile && !uploaded.attachment ? { attachment: "", fileName: "", fileType: "" } : uploaded),
      });
      return NextResponse.json({ ok: true, notice: publicNotice(notice) });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const notice = upsertNotice({
      ...existing,
      ...body,
      id,
      title: String(body.title ?? existing.title),
      description: String(body.description ?? body.body ?? existing.description),
      pinned: body.pinned === undefined ? existing.pinned : Boolean(body.pinned),
      publishAt: typeof body.publishAt === "string" ? body.publishAt : existing.publishAt,
      unpublishAt: typeof body.unpublishAt === "string" ? body.unpublishAt : existing.unpublishAt,
    });
    return NextResponse.json({ ok: true, notice: publicNotice(notice) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest, context: Params) {
  return PATCH(request, context);
}

export async function DELETE(request: NextRequest, context: Params) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!removeNotice(id)) return NextResponse.json({ ok: false, error: "Notice not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
