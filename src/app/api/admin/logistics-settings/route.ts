import { NextRequest, NextResponse } from "next/server";
import {
  readLogisticsSettings,
  restoreLogisticsSettingsVersion,
  saveLogisticsSettings,
} from "@/lib/server/vgmf-logistics-settings";

export async function GET() {
  return NextResponse.json({ ok: true, ...readLogisticsSettings() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const by = String(body?.by || "Admin");
    if (body?.action === "restore") {
      const store = restoreLogisticsSettingsVersion(Number(body?.version || 0), by);
      return NextResponse.json({ ok: true, ...store, message: `Restored settings v${body.version}.` });
    }
    if (!body?.settings) {
      return NextResponse.json({ ok: false, error: "settings object required." }, { status: 400 });
    }
    const store = saveLogisticsSettings(body.settings, by, String(body?.note || "Logistics settings saved"));
    return NextResponse.json({ ok: true, ...store, message: "VGMF Logistics settings saved & activated." });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Could not save settings." }, { status: 400 });
  }
}
