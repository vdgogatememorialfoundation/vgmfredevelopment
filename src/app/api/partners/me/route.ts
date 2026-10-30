import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { accountsForEmail, loadPartnerSnapshot } from "@/lib/server/partner-portals";

export const runtime = "nodejs";

function emailFrom(request: NextRequest) {
  const fromQuery = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (fromQuery) return fromQuery;
  for (const name of ["vgmf_session", "vgmf_admin_session"]) {
    const raw = request.cookies.get(name)?.value;
    if (!raw) continue;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw)) as { email?: string };
      if (parsed?.email) return parsed.email.trim().toLowerCase();
    } catch {
      /* next cookie */
    }
  }
  return "";
}

export async function GET(request: NextRequest) {
  const email = emailFrom(request);
  if (!email) {
    return NextResponse.json({ ok: true, account: null, tickets: [], payments: [] }, { headers: corsHeaders });
  }
  const snapshot = await loadPartnerSnapshot();
  return NextResponse.json({ ok: true, email, ...accountsForEmail(snapshot, email) }, { headers: { ...corsHeaders, "cache-control": "no-store" } });
}
