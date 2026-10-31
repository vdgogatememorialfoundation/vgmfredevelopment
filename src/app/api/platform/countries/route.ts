import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import {
  publicPlatformCountries,
  readPlatformCountries,
  writePlatformCountries,
  type PlatformCountries,
} from "@/lib/server/platform-countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

export async function GET() {
  const config = readPlatformCountries();
  return json({ ok: true, config, ...publicPlatformCountries(config) });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Partial<PlatformCountries> | null;
  const config = writePlatformCountries({
    allowInternational: body?.allowInternational !== false,
    enabledCountryCodes: Array.isArray(body?.enabledCountryCodes) ? body.enabledCountryCodes : [],
  });
  return json({ ok: true, config, ...publicPlatformCountries(config) });
}
