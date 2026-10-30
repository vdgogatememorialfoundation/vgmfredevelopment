import { NextResponse } from "next/server";
import { pingPostgres, postgresConfigured } from "@/lib/server/db";
import { platformEnv, publicSiteUrl } from "@/lib/platform";
import { vgmfDataDir } from "@/lib/server/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let postgres: { ok: boolean; database?: string; now?: string; error?: string } = { ok: false };
  if (postgresConfigured()) {
    try {
      const ping = await pingPostgres();
      postgres = ping ? { ok: true, database: ping.db, now: ping.now } : { ok: false, error: "no row" };
    } catch (error) {
      postgres = { ok: false, error: error instanceof Error ? error.message : "query failed" };
    }
  }
  return NextResponse.json({
    ok: true,
    env: platformEnv(),
    siteUrl: publicSiteUrl(),
    dataDir: vgmfDataDir(),
    postgres,
  });
}
