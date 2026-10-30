import { NextRequest, NextResponse } from "next/server";
import { patchMediaConfig, publicMediaStatus } from "@/lib/server/media-config";
import { denyUnlessPortal } from "@/lib/server/portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  return NextResponse.json({ ok: true, ...publicMediaStatus() });
}

export async function POST(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const status = patchMediaConfig(body);
  return NextResponse.json({ ok: true, ...status });
}
