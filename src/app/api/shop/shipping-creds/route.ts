import { NextRequest, NextResponse } from "next/server";
import { mergeShippingCreds } from "@/lib/server/shipping-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { shipping?: unknown } | null;
  if (body?.shipping) mergeShippingCreds(body.shipping);
  return NextResponse.json({ ok: true });
}
