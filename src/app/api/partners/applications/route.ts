import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { liveRecordsForEmail, liveStatusCatalogs } from "@/lib/server/partner-portals";

export const runtime = "nodejs";

function sessionIdentity(request: NextRequest) {
  for (const name of ["vgmf_session", "vgmf_admin_session"]) {
    const raw = request.cookies.get(name)?.value;
    if (!raw) continue;
    const candidates = [raw];
    try {
      candidates.push(decodeURIComponent(raw));
    } catch {
      /* already decoded */
    }
    for (const value of candidates) {
      try {
        const parsed = JSON.parse(value) as { email?: string; phone?: string };
        if (parsed?.email) return { email: parsed.email.trim().toLowerCase(), phone: parsed.phone || "" };
      } catch {
        /* next encoding */
      }
    }
  }
  return { email: "", phone: "" };
}

function emailFrom(request: NextRequest) {
  const fromQuery = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (fromQuery) return fromQuery;
  return sessionIdentity(request).email;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const email = emailFrom(request);
  const session = sessionIdentity(request);
  const phone = session.email && session.email === email ? session.phone : "";
  const [records, catalogs] = await Promise.all([
    email ? liveRecordsForEmail(email, phone) : Promise.resolve(null),
    liveStatusCatalogs(),
  ]);
  return NextResponse.json(
    {
      ok: true,
      email: email || null,
      tickets: records?.tickets ?? [],
      payments: records?.payments ?? [],
      statuses: records?.statuses ?? catalogs,
      syncedAt: records?.syncedAt ?? new Date().toISOString(),
      source: records?.source ?? "none",
    },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}
