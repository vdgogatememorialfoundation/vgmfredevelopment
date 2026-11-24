import { NextResponse } from "next/server";
import { readLabelPdf } from "@/lib/server/label-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Params) {
  const { token } = await context.params;
  const label = readLabelPdf(token ?? "");
  if (!label) return NextResponse.json({ ok: false, error: "This label link is not valid." }, { status: 404 });
  return new NextResponse(new Uint8Array(label.bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${label.name}"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
