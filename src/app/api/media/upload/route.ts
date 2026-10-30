import { NextRequest, NextResponse } from "next/server";
import { storeUploadedFile } from "@/lib/server/media-upload";
import { denyUnlessPortal } from "@/lib/server/portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ ok: false, error: "Choose a file to upload." }, { status: 400 });
  }
  try {
    const stored = await storeUploadedFile(file);
    return NextResponse.json({ ok: true, ...stored });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}
