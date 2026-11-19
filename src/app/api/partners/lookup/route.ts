import { commerceViewer } from "@/lib/server/commerce-viewer";
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
  const result = limitForViewer(request, await lookupPartnerIdentity(readFields(request, {})));
  return NextResponse.json({ ok: true, ...result }, { headers: { ...corsHeaders, "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = asRecord(await request.json().catch(() => ({})));
  const result = limitForViewer(request, await lookupPartnerIdentity(readFields(request, body)));
  return NextResponse.json({ ok: true, ...result }, { headers: { ...corsHeaders, "cache-control": "no-store" } });
}

const IDENTITY_KEYS = ["id", "email", "firstName", "lastName", "role", "partnerPortals", "partnerPasswordSet", "foundationPasswordSet", "portalRole"];

/** Before sign-in, only say whether the account exists; tickets, payments, phone and address are for the owner or staff. */
function limitForViewer<T extends { account: Record<string, unknown> | null; tickets: unknown[]; payments: unknown[] }>(request: NextRequest, result: T): T {
  const viewer = commerceViewer(request);
  const email = String(result.account?.email ?? "").toLowerCase();
  if (viewer.portal || (email && viewer.email && viewer.email.toLowerCase() === email)) return result;
  const account = result.account
    ? Object.fromEntries(Object.entries(result.account).filter(([key]) => IDENTITY_KEYS.includes(key)))
    : null;
  return { ...result, account, tickets: [], payments: [] };
}
