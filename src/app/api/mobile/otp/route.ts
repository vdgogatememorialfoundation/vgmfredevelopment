import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import {
  bearerToken,
  clearMobileOtp,
  createMobileSession,
  issueMobileOtp,
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

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "send");

  if (action === "session") {
    const session = sessionFromToken(bearerToken(request.headers.get("authorization")) ?? String(body?.token ?? ""));
    if (!session) return json({ ok: false, error: "Sign in again." }, 401);
    return json({ ok: true, session: { email: session.email, name: session.name } });
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ ok: false, error: "Enter a valid email address." }, 400);

  if (action === "send") {
    const issued = issueMobileOtp(email);
    if (issued.error) return json({ ok: false, error: issued.error }, 429);
    const name = String(body?.name ?? "there");
    try {
      const sent = await sendMobileEmail(
        email,
        "VGMF sign-in code",
        `Hi ${name},\n\nYour VGMF app sign-in code is ${issued.code}. It expires in 10 minutes.\n\nIf you did not request this, ignore the message.\n\n– Vaidya Gogate Memorial Foundation`
      );
      if (!sent) {
        clearMobileOtp(email);
        return json({
          ok: false,
          error: "Email is not configured. In Admin → Email add ZeptoMail or Zoho, then Admin → Mobile app → Publish to app.",
        });
      }
    } catch (error) {
      clearMobileOtp(email);
      return json({ ok: false, error: (error as Error).message || "Could not send the email code." });
    }
    return json({ ok: true, message: "A 6-digit code was sent to your email." });
  }

  if (action === "verify") {
    const invalid = verifyMobileOtp(email, String(body?.code ?? ""));
    if (invalid) return json({ ok: false, error: invalid }, 400);
    const session = createMobileSession(email, String(body?.name ?? ""));
    return json({ ok: true, token: session.token, email: session.email, name: session.name });
  }

  return json({ ok: false, error: "Unknown action." }, 400);
}
