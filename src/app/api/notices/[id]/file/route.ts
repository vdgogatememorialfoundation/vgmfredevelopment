import { NextRequest, NextResponse } from "next/server";
import { getNotice } from "@/lib/server/notices";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Params) {
  const { id } = await context.params;
  const notice = getNotice(id);
  if (!notice?.attachment) return NextResponse.json({ ok: false, error: "No file on this notice." }, { status: 404 });

  if (/^https?:\/\//.test(notice.attachment) || notice.attachment.startsWith("/")) {
    return NextResponse.redirect(notice.attachment);
  }

  const match = notice.attachment.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return NextResponse.json({ ok: false, error: "File is not available." }, { status: 404 });

  const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  const fileName = notice.fileName || `${notice.id}.bin`;
  return new NextResponse(bytes, {
    headers: {
      "content-type": notice.fileType || match[1] || "application/octet-stream",
      "content-disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
      "cache-control": "private, max-age=60",
    },
  });
}
