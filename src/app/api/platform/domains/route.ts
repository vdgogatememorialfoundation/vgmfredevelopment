import { NextRequest, NextResponse } from "next/server";
import { defaultDomainSettings, sanitizeDomainSettings, type DomainSettings } from "@/lib/domains";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { postgresConfigured, readDomainSettingsFromStore, writeDomainSettingsToStore } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const stored = await readDomainSettingsFromStore();
  const settings = stored ?? defaultDomainSettings();
  return NextResponse.json(
    { ok: true, postgres: postgresConfigured(), settings },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Partial<DomainSettings> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Send domain settings JSON." }, { status: 400, headers: corsHeaders });
  }
  const settings = await writeDomainSettingsToStore(sanitizeDomainSettings(body));
  return NextResponse.json(
    { ok: true, postgres: postgresConfigured(), settings },
    { headers: corsHeaders }
  );
}
