import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { getNotice } from "@/lib/server/notices";

type Params = { params: Promise<{ id: string }> };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(_request: NextRequest, context: Params) {
  const { id } = await context.params;
  const notice = getNotice(id);
  if (!notice?.attachment) {
    return NextResponse.json({ ok: false, error: "No file on this notice." }, { status: 404, headers: corsHeaders });
  }

  if (/^https?:\/\//.test(notice.attachment) || notice.attachment.startsWith("/")) {
    return NextResponse.redirect(notice.attachment);
  }

  const match = notice.attachment.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return NextResponse.json({ ok: false, error: "File is not available." }, { status: 404, headers: corsHeaders });

  const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  const fileName = notice.fileName || `${notice.id}.bin`;
  return new NextResponse(bytes, {
    headers: {
      "content-type": notice.fileType || match[1] || "application/octet-stream",
      "content-disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
      "cache-control": "private, max-age=60",
      ...corsHeaders,
    },
  });
}
