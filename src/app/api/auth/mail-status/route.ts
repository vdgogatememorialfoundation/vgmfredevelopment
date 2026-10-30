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
  zohoCpaasApiKey?: string;
  zohoCpaasDomain?: string;
};

function envMailReady() {
  return Boolean(
    ((process.env.ZEPTOMAIL_TOKEN || "").trim() && (process.env.MAIL_FROM_ADDRESS || "").trim()) ||
      ((process.env.ZOHO_CPAAS_API_KEY || "").trim() && (process.env.MAIL_FROM_ADDRESS || "").trim()) ||
      ((process.env.ZOHO_REFRESH_TOKEN || "").trim() && (process.env.MAIL_FROM_ADDRESS || "").trim())
  );
}

function credsReady(creds: EmailCreds | null) {
  if (!creds) return false;
  if (creds.zeptoToken?.trim()) return true;
  if (creds.zohoCpaasApiKey?.trim()) return true;
  if (creds.zohoRefreshToken?.trim() && creds.fromAddress?.trim()) return true;
  return false;
}

function pickString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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
  const previous = (await readKv<EmailCreds>("admin", KEY)) ?? {};
  const next: EmailCreds = {
    provider: pickString(body.provider, previous.provider || "cpaas"),
    zeptoToken: pickString(body.zeptoToken, previous.zeptoToken || ""),
    zeptoHost: pickString(body.zeptoHost, previous.zeptoHost || "cpaas.zoho.in"),
    fromAddress: pickString(body.fromAddress, previous.fromAddress || "noreply@vaidyagogate.org"),
    fromName: pickString(body.fromName, previous.fromName || "Vaidya Gogate Memorial Foundation"),
    zohoClientId: pickString(body.zohoClientId, previous.zohoClientId || ""),
    zohoClientSecret: pickString(body.zohoClientSecret, previous.zohoClientSecret || ""),
    zohoRefreshToken: pickString(body.zohoRefreshToken, previous.zohoRefreshToken || ""),
    zohoAccountId: pickString(body.zohoAccountId, previous.zohoAccountId || ""),
    zohoDomain: pickString(body.zohoDomain, previous.zohoDomain || "zoho.in"),
    zohoCpaasApiKey: pickString(body.zohoCpaasApiKey, previous.zohoCpaasApiKey || ""),
    zohoCpaasDomain: pickString(body.zohoCpaasDomain, previous.zohoCpaasDomain || "zoho.in"),
  };
  await writeKv("admin", KEY, next);
  return NextResponse.json(
    { ok: true, emailOtp: envMailReady() || credsReady(next) },
    { headers: { ...corsHeaders, "cache-control": "no-store" } }
  );
}
