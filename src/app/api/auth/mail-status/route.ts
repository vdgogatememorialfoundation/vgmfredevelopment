import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/server/mobile-feed";
import { readKv, writeKv } from "@/lib/server/db";

export const runtime = "nodejs";

const KEY = "email-creds";

type EmailCreds = {
  provider?: string;
  zeptoToken?: string;
  zeptoHost?: string;
  fromAddress?: string;
  fromName?: string;
  zohoClientId?: string;
  zohoClientSecret?: string;
  zohoRefreshToken?: string;
  zohoAccountId?: string;
  zohoDomain?: string;
};

function envMailReady() {
  return Boolean(
    ((process.env.ZEPTOMAIL_TOKEN || "").trim() && (process.env.MAIL_FROM_ADDRESS || "").trim()) ||
      ((process.env.ZOHO_REFRESH_TOKEN || "").trim() && (process.env.MAIL_FROM_ADDRESS || "").trim())
  );
}

function credsReady(creds: EmailCreds | null) {
  if (!creds) return false;
  if (creds.zeptoToken?.trim() && creds.fromAddress?.trim()) return true;
  if (creds.zohoRefreshToken?.trim() && creds.fromAddress?.trim()) return true;
  return false;
}

export async function GET() {
  const stored = await readKv<EmailCreds>("admin", KEY);
  return NextResponse.json(
    { ok: true, emailOtp: envMailReady() || credsReady(stored) },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as EmailCreds;
  const next: EmailCreds = {
    provider: typeof body.provider === "string" ? body.provider : "zeptomail",
    zeptoToken: typeof body.zeptoToken === "string" ? body.zeptoToken : "",
    zeptoHost: typeof body.zeptoHost === "string" ? body.zeptoHost : "",
    fromAddress: typeof body.fromAddress === "string" ? body.fromAddress : "",
    fromName: typeof body.fromName === "string" ? body.fromName : "",
    zohoClientId: typeof body.zohoClientId === "string" ? body.zohoClientId : "",
    zohoClientSecret: typeof body.zohoClientSecret === "string" ? body.zohoClientSecret : "",
    zohoRefreshToken: typeof body.zohoRefreshToken === "string" ? body.zohoRefreshToken : "",
    zohoAccountId: typeof body.zohoAccountId === "string" ? body.zohoAccountId : "",
    zohoDomain: typeof body.zohoDomain === "string" ? body.zohoDomain : "",
  };
  await writeKv("admin", KEY, next);
  return NextResponse.json(
    { ok: true, emailOtp: envMailReady() || credsReady(next) },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}
