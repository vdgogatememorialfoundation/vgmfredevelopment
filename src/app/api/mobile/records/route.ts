import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { bearerToken, sessionFromToken } from "@/lib/server/mobile-store";
import { findAccount } from "@/lib/server/accounts";
import { liveRecordsForEmail } from "@/lib/server/partner-portals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const token = bearerToken(request.headers.get("authorization"));
  const session = sessionFromToken(token ?? "");
  if (!session) return json({ ok: false, error: "Sign in again." }, 401);
  const account = findAccount(session.email);
  const email = (account?.email || session.email).trim().toLowerCase();
  const records = email ? await liveRecordsForEmail(email) : null;
  return json({
    ok: true,
    email,
    tickets: records?.tickets ?? [],
    payments: records?.payments ?? [],
    statuses: records?.statuses ?? {},
    syncedAt: records?.syncedAt ?? new Date().toISOString(),
    source: records?.source ?? "none",
  });
}
