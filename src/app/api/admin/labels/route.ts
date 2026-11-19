import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { saveLabelPdf } from "@/lib/server/label-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Saves a shipping label PDF made in the desk and returns its unique download link. */
export async function POST(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: string; pdf?: string };
    const bytes = new Uint8Array(Buffer.from(String(body.pdf ?? ""), "base64"));
    const token = saveLabelPdf(bytes, String(body.name ?? "label.pdf"));
    return NextResponse.json({ ok: true, url: `/api/label/${token}` }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not save the label." }, { status: 400 });
  }
}
