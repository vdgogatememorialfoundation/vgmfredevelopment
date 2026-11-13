import { NextRequest, NextResponse } from "next/server";
import { portalSessionFrom } from "@/lib/server/portal-auth";
import { checkPortalLogin, removePortalAccount, savePortalAccounts } from "@/lib/server/portal-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin(request: NextRequest) {
  const session = portalSessionFrom(request);
  return session?.role === "admin" || session?.role === "coadmin";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { action?: string; email?: string; password?: string; accounts?: unknown[] } | null;
  const action = String(body?.action ?? "");
  if (action === "login") {
    const account = checkPortalLogin(String(body?.email ?? ""), String(body?.password ?? ""));
    if (!account) return NextResponse.json({ ok: false, error: "Incorrect email or password." }, { status: 401 });
    return NextResponse.json({ ok: true, account }, { headers: { "cache-control": "no-store" } });
  }
  if (!admin(request)) return NextResponse.json({ ok: false, error: "Sign in as admin." }, { status: 401 });
  if (action === "save") return NextResponse.json({ ok: true, saved: savePortalAccounts(Array.isArray(body?.accounts) ? body.accounts : []) });
  if (action === "remove" && body?.email) {
    removePortalAccount(String(body.email));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
