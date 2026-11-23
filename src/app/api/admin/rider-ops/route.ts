import { NextRequest, NextResponse } from "next/server";
import { portalSessionFrom } from "@/lib/server/portal-auth";
import { listHandovers, riderSettings, riderWallet, saveRiderSettings, verifyHandover, walletEntry, type RiderSettings } from "@/lib/server/rider-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

function adminOnly(request: NextRequest) {
  const session = portalSessionFrom(request);
  if (!session) return { error: json({ ok: false, error: "Sign in required." }, 401) };
  if (!["admin", "coadmin"].includes(String(session.role))) return { error: json({ ok: false, error: "Admins only." }, 403) };
  return { session };
}

export async function GET(request: NextRequest) {
  const auth = adminOnly(request);
  if (auth.error) return auth.error;
  const email = request.nextUrl.searchParams.get("wallet") || "";
  return json({ ok: true, settings: riderSettings(), handovers: listHandovers(), wallet: email ? riderWallet(email) : null });
}

export async function POST(request: NextRequest) {
  const auth = adminOnly(request);
  if (auth.error) return auth.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const by = String(auth.session?.name || auth.session?.email || "Admin");
  try {
    if (body.action === "settings") return json({ ok: true, settings: saveRiderSettings(body.settings as Partial<RiderSettings>) });
    if (body.action === "verify-handover") return json({ ok: true, handover: verifyHandover(String(body.id || ""), body.ok !== false, by) });
    if (body.action === "wallet-entry") {
      const type = String(body.type || "payout") as "payout" | "adjustment" | "incentive";
      return json({ ok: true, txn: walletEntry({ email: String(body.email || ""), type, amount: Number(body.amount || 0), note: String(body.note || ""), by }) });
    }
    return json({ ok: false, error: "Unknown action." }, 400);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Failed." }, 400);
  }
}
