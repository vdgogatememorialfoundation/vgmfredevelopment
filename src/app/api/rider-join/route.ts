import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createPortalMobileSession } from "@/lib/server/portal-auth";
import { findPortalAccount, issuePortalOtp, portalAccountBlocked, registerDeliveryPartnerAccount, verifyPortalOtp } from "@/lib/server/portal-accounts";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import { emailRiderKyc } from "@/lib/server/agent-kyc";
import { activeRiderLink, countRiderLinkSignup, markEnrollmentFromLink } from "@/lib/server/rider-onboarding";
import { ensureAgentEnrollmentOnSignup, readLogisticsStore, requestAgentHubEnrollment } from "@/lib/server/vgmf-logistics";

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "");
  const link = activeRiderLink(String(body.token || ""));
  if (!link) return fail("This sign-up link is not valid or has been switched off. Ask the hub for a new link.", 404);

  if (action === "link") {
    const hubs = readLogisticsStore().hubs.map((h) => ({ code: h.code, name: h.name, city: (h as { city?: string }).city || "" }));
    return NextResponse.json({ ok: true, label: link.label, hubCode: link.hubCode, hubs: link.hubCode ? hubs.filter((h) => h.code === link.hubCode) : hubs });
  }

  if (action === "send-code") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!email.includes("@")) return fail("Enter a valid email address.");
    let account = findPortalAccount(email);
    if (body.signup) {
      if (account) return fail("This email is already registered. Use Sign in instead.");
      const name = String(body.name || "").trim();
      const phone = String(body.phone || "").replace(/[^\d+]/g, "");
      const hubCode = link.hubCode || String(body.hubCode || "").trim();
      if (!name) return fail("Enter your full name as on your ID.");
      if (phone.replace(/\D/g, "").length < 10) return fail("Enter a valid mobile number.");
      if (!hubCode) return fail("Choose your hub.");
      if (!readLogisticsStore().hubs.some((h) => h.code.toUpperCase() === hubCode.toUpperCase())) return fail("Choose a valid hub.");
      account = registerDeliveryPartnerAccount({ name, email, phone, password: randomBytes(18).toString("base64url") });
      ensureAgentEnrollmentOnSignup({ email, name, phone });
      requestAgentHubEnrollment({ email, name, phone, vehicleNo: String(body.vehicleNo || ""), hubCode });
      markEnrollmentFromLink(email, link.token);
      countRiderLinkSignup(link.token);
      emailRiderKyc(email, "instructions");
    }
    if (!account) return fail("No delivery partner account with this email. Use Sign up.", 404);
    if (portalAccountBlocked(account)) return fail("This account is blocked. Contact the hub.", 403);
    const code = issuePortalOtp(email);
    if (code) {
      const sent = await sendMobileEmail(
        email,
        `${code} is your VGMF delivery partner sign-up code`,
        `${code} is your Vaidya Gogate Memorial Foundation verification code.\n\nIt expires in 10 minutes.`
      ).catch(() => false);
      if (!sent) return fail("Could not email the code right now. Try again in a minute.", 502);
    }
    return NextResponse.json({ ok: true, message: code ? `A 6-digit code was emailed to ${email}.` : `A code was already sent to ${email} a few seconds ago.` });
  }

  if (action === "verify-code") {
    const email = String(body.email || "").trim().toLowerCase();
    const account = findPortalAccount(email);
    if (!account) return fail("Account not found.", 404);
    const invalid = verifyPortalOtp(email, String(body.code || ""));
    if (invalid) return fail(invalid, 401);
    const session = createPortalMobileSession({
      email: String(account.email),
      role: String(account.role || "staff"),
      firstName: String(account.firstName || ""),
      lastName: String(account.lastName || ""),
      name: [account.firstName, account.lastName].filter(Boolean).join(" ").trim() || String(account.email),
      staffRoleId: account.staffRoleId ? String(account.staffRoleId) : undefined,
    });
    return NextResponse.json({ ok: true, token: session.token, name: session.name });
  }

  return fail("Unknown action.");
}
