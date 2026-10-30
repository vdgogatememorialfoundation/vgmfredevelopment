import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { syncPartnerPortals } from "@/lib/server/partner-portals";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  const snapshot = await syncPartnerPortals("full");
  return NextResponse.json({
    ok: true,
    syncedAt: snapshot.syncedAt,
    stats: snapshot.stats,
    events: snapshot.events.length,
    notices: snapshot.notices.length,
    accounts: snapshot.accounts.length,
  });
}
