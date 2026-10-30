import { NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { loadPartnerSnapshot } from "@/lib/server/partner-portals";

export const runtime = "nodejs";

export async function GET() {
  const snapshot = await loadPartnerSnapshot();
  return NextResponse.json(
    {
      ok: true,
      syncedAt: snapshot.syncedAt,
      events: snapshot.events.map((event) => ({
        id: event.id,
        name: event.name,
        slug: event.slug,
        startDate: event.startDate,
        endDate: event.endDate,
        registrationStart: event.registrationStart,
        registrationEnd: event.registrationEnd,
        venue: event.venue,
        city: event.city,
        mode: event.mode,
        eventType: event.eventType,
        registrationStatus: event.registrationStatus,
        source: event.source,
        sourceUrl: event.sourceUrl,
        schedule: event.schedule ?? [],
      })),
    },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}
