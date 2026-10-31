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
} from "@/lib/server/accounts";
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
  return {
    ok: true,
    token: session.token,
    email: session.email,
    name: session.name,
    accountId,
    expiresAt: session.expiresAt,
    account: publicAccount(findAccount(email)!),
  };
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
    if (accountExists(email, phone)) {
      return json({ ok: false, error: "An account with this email or phone is already created. Please login." }, 409);
    }
    const issued = issueMobileOtp(email);
    if (issued.error) return json({ ok: false, error: issued.error }, 429);
    try {
      const sent = await sendMobileEmail(
        email,
        "VGMF account verification",
        `Hi ${firstName},\n\nYour VGMF verification code is ${issued.code}. It expires in 10 minutes.\n\n– Vaidya Gogate Memorial Foundation`
      );
      if (!sent) {
        clearMobileOtp(email);
        return json({ ok: false, error: "Email is not configured. Ask Admin to connect ZeptoMail, then try again." }, 502);
      }
    } catch (error) {
      clearMobileOtp(email);
      return json({ ok: false, error: (error as Error).message || "Could not send the email code." }, 502);
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
    const account = findAccount(identifier);
    if (!account) return json({ ok: false, error: "No account found with these details. Please create an account first." }, 404);
    if (method === "password") {
      if (!password) return json({ ok: false, error: "Enter your Foundation website password, then we will send a one-time code." }, 400);
      if (!passwordOk(account, password)) {
        return json({ ok: false, error: "Incorrect password. Use Forgot password if you need a reset." }, 401);
      }
    }
    const issued = issueMobileOtp(account.email);
    if (issued.error) return json({ ok: false, error: issued.error }, 429);
    try {
      await sendMobileEmail(
        account.email,
        "VGMF sign-in code",
        `Hi ${account.firstName},\n\nYour VGMF sign-in code is ${issued.code}. It expires in 10 minutes.\n\n– Vaidya Gogate Memorial Foundation`
      );
    } catch (error) {
      return json({ ok: false, error: (error as Error).message || "Could not send the email code." }, 502);
    }
    return json({ ok: true, email: account.email, name: publicAccount(account).name, message: `A code was sent to ${account.email}.` });
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
    const account = findAccount(identifier);
    if (!account) return json({ ok: false, error: "No account found with these details." }, 404);
    const issued = issueMobileOtp(account.email);
    if (issued.error) return json({ ok: false, error: issued.error }, 429);
    await sendMobileEmail(
      account.email,
      "VGMF password reset",
      `Hi ${account.firstName},\n\nYour VGMF reset code is ${issued.code}. It expires in 10 minutes.\n\n– Vaidya Gogate Memorial Foundation`
    );
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
    let account = findAccount(email) || findAccount(phone);
    if (!account) {
      try {
        account = createAccount({
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
      } catch {
        account = findAccount(email) || findAccount(phone);
      }
    }
    if (!account) return json({ ok: false, error: "Could not sync this account." }, 400);
    if (password && !account.passwordHash) {
      account = setAccountPassword(account.email, password) ?? account;
    }
    return json({ ok: true, account: publicAccount(account) });
  }

  return json({ ok: false, error: "Unknown action." }, 400);
}
