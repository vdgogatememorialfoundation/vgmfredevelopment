import { NextResponse } from "next/server";
import { publicPartnerSchedules } from "@/lib/server/partner-portals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await publicPartnerSchedules();
    return NextResponse.json({
      ok: true,
      events: events.map((event) => ({
        ...event,
        shortDescription: "",
        description: "",
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, events: [] });
  }
}
