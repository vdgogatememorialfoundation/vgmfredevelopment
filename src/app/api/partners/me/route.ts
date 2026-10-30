import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { accountsForEmail, liveRecordsForEmail, loadPartnerSnapshot, sanitizeAccountForClient } from "@/lib/server/partner-portals";

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
  const related = accountsForEmail(snapshot, email);
  const live = await liveRecordsForEmail(email);
  return NextResponse.json(
    {
      ok: true,
      email,
      ...related,
      tickets: live.tickets.length ? live.tickets : related.tickets,
      payments: live.payments.length ? live.payments : related.payments,
      statuses: live.statuses,
      syncedAt: live.syncedAt,
      account: related.account ? sanitizeAccountForClient(related.account) : null,
    },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}
