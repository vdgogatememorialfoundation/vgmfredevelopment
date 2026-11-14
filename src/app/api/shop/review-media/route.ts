import { NextRequest, NextResponse } from "next/server";
import { storeUploadedFile } from "@/lib/server/media-upload";
import { shopperEmail } from "@/lib/server/commerce-viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

/** Signed-in customers attach photos or short videos to a product review. */
export async function POST(request: NextRequest) {
  if (!shopperEmail(request)) return NextResponse.json({ ok: false, error: "Sign in to add photos or videos." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ ok: false, error: "Choose a photo or video." }, { status: 400 });
  if (!/^(image|video)\//.test(file.type)) return NextResponse.json({ ok: false, error: "Only photos and videos can be added." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "Each file must be under 25 MB." }, { status: 400 });
  try {
    const stored = await storeUploadedFile(file);
    return NextResponse.json({ ok: true, ...stored });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}
