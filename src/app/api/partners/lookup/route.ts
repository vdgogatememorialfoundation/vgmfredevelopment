import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { lookupPartnerIdentity } from "@/lib/server/partner-portals";

export const runtime = "nodejs";

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readFields(request: NextRequest, body: Record<string, unknown>) {
  const query = request.nextUrl.searchParams;
  const pick = (key: string) => String(body[key] ?? query.get(key) ?? "").trim();
  return {
    identifier: pick("identifier"),
    email: pick("email"),
    phone: pick("phone"),
    alternatePhone: pick("alternatePhone"),
    password: pick("password"),
  };
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const result = await lookupPartnerIdentity(readFields(request, {}));
  return NextResponse.json({ ok: true, ...result }, { headers: { ...corsHeaders, "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = asRecord(await request.json().catch(() => ({})));
  const result = await lookupPartnerIdentity(readFields(request, body));
  return NextResponse.json({ ok: true, ...result }, { headers: { ...corsHeaders, "cache-control": "no-store" } });
}
