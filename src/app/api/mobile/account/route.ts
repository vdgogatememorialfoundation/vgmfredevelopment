import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import {
  accountExists,
  createAccount,
  findAccount,
  passwordOk,
  publicAccount,
  setAccountPassword,
  upsertAccount,
} from "@/lib/server/accounts";
import { lookupPartnerIdentity } from "@/lib/server/partner-portals";
import {
  bearerToken,
  clearMobileOtp,
  createMobileSession,
  issueMobileOtp,
  publicSession,
  sessionFromToken,
  verifyMobileOtp,
} from "@/lib/server/mobile-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...corsHeaders, "cache-control": "no-store" } });
}

function sessionPayload(email: string, name: string, accountId?: string) {
  const session = createMobileSession(email, name);
  const account = findAccount(email);
  return {
    ok: true,
    token: session.token,
    email: session.email,
    name: session.name,
    accountId: accountId || account?.accountId,
    expiresAt: session.expiresAt,
    otpRequired: false,
    account: account ? publicAccount(account) : undefined,
  };
}

async function resolveAccount(identifier: string) {
  const local = findAccount(identifier);
  if (local) return local;
  const partner = await lookupPartnerIdentity({ identifier });
  const found = partner.account;
  if (!found?.email || !found.phone) return null;
  return upsertAccount({
    id: found.id,
    accountId: found.accountId,
    salutation: found.salutation,
    firstName: found.firstName,
    lastName: found.lastName,
    middleName: found.middleName,
    email: found.email,
    phone: found.phone,
    whatsapp: found.whatsapp,
    alternatePhone: found.alternatePhone,
  });
}

async function sendCode(email: string, name: string, subject: string) {
  const issued = issueMobileOtp(email);
  if (issued.error) return { error: issued.error, status: 429 as const };
  try {
    const sent = await sendMobileEmail(
      email,
      subject,
      `Hi ${name},\n\nYour VGMF verification code is ${issued.code}. It expires in 10 minutes.\n\n– Vaidya Gogate Memorial Foundation`
    );
    if (!sent) {
      clearMobileOtp(email);
      return { error: "offline" as const, status: 502 as const };
    }
  } catch (error) {
    clearMobileOtp(email);
    return { error: (error as Error).message || "Could not send the email code.", status: 502 as const };
  }
  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const token = bearerToken(request.headers.get("authorization")) ?? String(body?.token ?? "");

  if (action === "session") {
    const session = sessionFromToken(token);
    if (!session) return json({ ok: false, error: "Sign in again." }, 401);
    const account = findAccount(session.email);
    return json({ ok: true, session: { ...publicSession(session), accountId: account?.accountId }, account: account ? publicAccount(account) : null });
  }

  if (action === "register") {
    const firstName = String(body?.firstName ?? "").trim();
    const lastName = String(body?.lastName ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const phone = String(body?.phone ?? "").trim();
    if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || !/^\+?[0-9]{10,15}$/.test(phone.replace(/\s/g, ""))) {
      return json({ ok: false, error: "Enter your first name, last name, email and a valid mobile number." }, 400);
    }
    if (accountExists(email, phone) || (await resolveAccount(email)) || (await resolveAccount(phone))) {
      return json({ ok: false, error: "An account with this email or phone is already created. Please login." }, 409);
    }
    const mailed = await sendCode(email, firstName, "VGMF account verification");
    if ("error" in mailed) {
      return json({ ok: false, error: mailed.error === "offline" ? "Email is not configured. Ask Admin to connect ZeptoMail, then try again." : mailed.error }, mailed.status);
    }
    return json({
      ok: true,
      pending: {
        salutation: String(body?.salutation ?? "Dr."),
        firstName,
        middleName: String(body?.middleName ?? ""),
        lastName,
        email,
        phone,
        whatsapp: String(body?.whatsapp ?? phone),
        alternatePhone: String(body?.alternatePhone ?? phone),
      },
      message: `A code was sent to ${email}.`,
    });
  }

  if (action === "verify-register") {
    const email = String(body?.email ?? "").trim().toLowerCase();
    const invalid = verifyMobileOtp(email, String(body?.code ?? ""));
    if (invalid) return json({ ok: false, error: invalid }, 400);
    try {
      const account = createAccount({
        salutation: String(body?.salutation ?? "Dr."),
        firstName: String(body?.firstName ?? ""),
        middleName: String(body?.middleName ?? ""),
        lastName: String(body?.lastName ?? ""),
        email,
        phone: String(body?.phone ?? ""),
        whatsapp: String(body?.whatsapp ?? ""),
        alternatePhone: String(body?.alternatePhone ?? ""),
        password: String(body?.password ?? "") || undefined,
      });
      const name = [account.firstName, account.lastName].filter(Boolean).join(" ");
      return json({ ...sessionPayload(account.email, name, account.accountId), message: `Your Account ID is ${account.accountId}.` });
    } catch (error) {
      return json({ ok: false, error: (error as Error).message }, 409);
    }
  }

  if (action === "login") {
    const identifier = String(body?.identifier ?? body?.email ?? "").trim();
    const password = String(body?.password ?? "");
    const method = String(body?.method ?? "password");
    const account = await resolveAccount(identifier);
    if (!account) return json({ ok: false, error: "No account found with these details. Please create an account first." }, 404);
    if (method === "password") {
      if (!account.passwordHash) {
        return json({
          ok: false,
          error: "Seminar, Autism and Fellowship passwords are not used here. Use Email OTP, or Forgot password to set a Foundation password.",
        }, 401);
      }
      if (!password) return json({ ok: false, error: "Enter your Foundation website password, then we will send a one-time code." }, 400);
      if (!passwordOk(account, password)) {
        return json({ ok: false, error: "Incorrect password. Use Forgot password if you need a reset." }, 401);
      }
    }
    const mailed = await sendCode(account.email, account.firstName, "VGMF sign-in code");
    if ("error" in mailed) {
      if (mailed.error === "offline") {
        return json({ ...sessionPayload(account.email, publicAccount(account).name, account.accountId), message: "Signed in." });
      }
      return json({ ok: false, error: mailed.error }, mailed.status);
    }
    return json({ ok: true, otpRequired: true, email: account.email, name: publicAccount(account).name, message: `A code was sent to ${account.email}.` });
  }

  if (action === "verify-login") {
    const email = String(body?.email ?? "").trim().toLowerCase();
    const invalid = verifyMobileOtp(email, String(body?.code ?? ""));
    if (invalid) return json({ ok: false, error: invalid }, 400);
    const account = findAccount(email);
    if (!account) return json({ ok: false, error: "No account found with these details. Please create an account first." }, 404);
    return json(sessionPayload(account.email, publicAccount(account).name, account.accountId));
  }

  if (action === "forgot") {
    const identifier = String(body?.identifier ?? "").trim();
    const account = await resolveAccount(identifier);
    if (!account) return json({ ok: false, error: "No account found with these details." }, 404);
    const mailed = await sendCode(account.email, account.firstName, "VGMF password reset");
    if ("error" in mailed) return json({ ok: false, error: mailed.error === "offline" ? "Email is not configured. Ask Admin to connect ZeptoMail, then try again." : mailed.error }, mailed.status);
    return json({ ok: true, email: account.email, message: `A reset code was sent to ${account.email}.` });
  }

  if (action === "reset") {
    const email = String(body?.email ?? "").trim().toLowerCase();
    const invalid = verifyMobileOtp(email, String(body?.code ?? ""));
    if (invalid) return json({ ok: false, error: invalid }, 400);
    const password = String(body?.password ?? "");
    if (password.length < 8) return json({ ok: false, error: "Choose a password of at least 8 characters." }, 400);
    const account = setAccountPassword(email, password);
    if (!account) return json({ ok: false, error: "No account found." }, 404);
    return json({ ok: true, account: publicAccount(account), message: "Password updated. Sign in with your new Foundation password." });
  }

  if (action === "sync") {
    const firstName = String(body?.firstName ?? "").trim();
    const lastName = String(body?.lastName ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const phone = String(body?.phone ?? "").trim();
    const password = String(body?.password ?? "");
    if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || !phone) {
      return json({ ok: false, error: "Enter your name, email and mobile to sync this account." }, 400);
    }
    let account =
      (await resolveAccount(email)) ||
      (await resolveAccount(phone)) ||
      upsertAccount({
        salutation: String(body?.salutation ?? "Dr."),
        firstName,
        middleName: String(body?.middleName ?? ""),
        lastName,
        email,
        phone,
        whatsapp: String(body?.whatsapp ?? phone),
        alternatePhone: String(body?.alternatePhone ?? phone),
        password: password || undefined,
      });
    if (!account) return json({ ok: false, error: "Could not sync this account." }, 400);
    if (password && !account.passwordHash) {
      account = setAccountPassword(account.email, password) ?? account;
    }
    return json({ ok: true, account: publicAccount(account) });
  }

  return json({ ok: false, error: "Unknown action." }, 400);
}
