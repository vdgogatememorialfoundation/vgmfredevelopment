import { NextRequest, NextResponse } from "next/server";
import { readMapsKey, saveMapsKey } from "@/lib/server/shipping-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, key: readMapsKey() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { key?: string } | null;
  if (body?.key) saveMapsKey(body.key);
  return NextResponse.json({ ok: true });
}
