import { NextRequest, NextResponse } from "next/server";
import { createRiderLink, listRiderLinks, setRiderLinkActive } from "@/lib/server/rider-onboarding";
import { readLogisticsStore } from "@/lib/server/vgmf-logistics";

export async function GET() {
  const hubs = readLogisticsStore().hubs.map((h) => ({ code: h.code, name: h.name }));
  return NextResponse.json({ ok: true, links: listRiderLinks(), hubs });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const by = String(body?.by || "Admin");
    if (body?.action === "toggle") {
      setRiderLinkActive(String(body?.token || ""), Boolean(body?.active));
    } else {
      createRiderLink({ label: String(body?.label || ""), hubCode: String(body?.hubCode || ""), by });
    }
    return NextResponse.json({ ok: true, links: listRiderLinks() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Could not save the link." }, { status: 400 });
  }
}
