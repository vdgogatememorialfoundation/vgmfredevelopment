import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { liveRecordsForEmail, liveStatusCatalogs } from "@/lib/server/partner-portals";

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

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const email = emailFrom(request);
  const [records, catalogs] = await Promise.all([
    email ? liveRecordsForEmail(email) : Promise.resolve(null),
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
