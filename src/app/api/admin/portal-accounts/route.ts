import { NextRequest, NextResponse } from "next/server";
import { portalSessionFrom } from "@/lib/server/portal-auth";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import {
  checkPortalLogin,
  findPortalAccount,
  issuePortalOtp,
  portalAccountBlocked,
  readPortalAccess,
  removePortalAccount,
  savePortalAccess,
  savePortalAccounts,
  verifyPortalOtp,
} from "@/lib/server/portal-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOCKED = "This account is disabled. Contact support@vaidyagogate.org for help.";

function admin(request: NextRequest) {
  const session = portalSessionFrom(request);
  return session?.role === "admin" || session?.role === "coadmin";
}

type Body = {
  action?: string;
  email?: string;
  password?: string;
  code?: string;
  portal?: string;
  accounts?: unknown[];
  roles?: unknown[];
  customModules?: unknown[];
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const action = String(body?.action ?? "");
  const email = String(body?.email ?? "").trim();
  if (action === "login") {
    const account = checkPortalLogin(email, String(body?.password ?? ""));
    if (!account) return NextResponse.json({ ok: false, error: "Incorrect email or password." }, { status: 401 });
    return NextResponse.json({ ok: true, account, ...readPortalAccess() }, { headers: { "cache-control": "no-store" } });
  }
  if (action === "otp-send") {
    const account = email ? findPortalAccount(email) : null;
    if (!account) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    if (portalAccountBlocked(account)) return NextResponse.json({ ok: false, error: BLOCKED }, { status: 403 });
    const code = issuePortalOtp(email);
    if (code) {
      const portal = String(body?.portal || "Staff").replace(/[^\w &-]/g, "").slice(0, 40) || "Staff";
      const sent = await sendMobileEmail(
        account.email,
        `${code} is your sign-in code`,
        `${code} is your Vaidya Gogate Memorial Foundation sign-in code for the ${portal} portal.\n\nIt expires in 10 minutes. If you did not try to sign in, ignore this email.`
      ).catch(() => false);
      if (!sent) return NextResponse.json({ ok: false, error: "The code could not be emailed. Try again in a minute." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }
  if (action === "otp-verify") {
    const account = email ? findPortalAccount(email) : null;
    if (!account) return NextResponse.json({ ok: false, error: "No account found for this email." }, { status: 404 });
    if (portalAccountBlocked(account)) return NextResponse.json({ ok: false, error: BLOCKED }, { status: 403 });
    const invalid = verifyPortalOtp(email, String(body?.code ?? ""));
    if (invalid) return NextResponse.json({ ok: false, error: invalid }, { status: 401 });
    return NextResponse.json({ ok: true, account, ...readPortalAccess() }, { headers: { "cache-control": "no-store" } });
  }
  if (!admin(request)) return NextResponse.json({ ok: false, error: "Sign in as admin." }, { status: 401 });
  if (action === "save") {
    if (body?.roles || body?.customModules) savePortalAccess({ roles: body.roles, customModules: body.customModules });
    return NextResponse.json({ ok: true, saved: savePortalAccounts(Array.isArray(body?.accounts) ? body.accounts : []) });
  }
  if (action === "remove" && email) {
    removePortalAccount(email);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
