import { NextRequest, NextResponse } from "next/server";
import { findValidCertificate, publicCertificate } from "@/lib/server/certificates";
import { partnerForKey, partnerForOrigin, readApiKey } from "@/lib/partner-keys";

function corsHeaders(origin: string | null, allowOrigin?: string) {
  const headers = new Headers();
  if (allowOrigin) headers.set("Access-Control-Allow-Origin", allowOrigin);
  headers.set("Access-Control-Allow-Headers", "x-api-key, authorization, content-type");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Vary", "Origin");
  return headers;
}

function authorize(request: NextRequest) {
  const origin = request.headers.get("origin");
  const key = readApiKey(request);
  const partnerFromKey = partnerForKey(key);
  const partnerFromOrigin = partnerForOrigin(origin);

  if (partnerFromOrigin) {
    if (!partnerFromKey || partnerFromKey.id !== partnerFromOrigin.id) {
      return {
        ok: false as const,
        status: 401,
        headers: corsHeaders(origin),
        error: "Invalid API key. seminar.vaidyagogate.org and autism.vaidyagogate.org must send x-api-key.",
      };
    }
    return { ok: true as const, partner: partnerFromKey, headers: corsHeaders(origin, partnerFromKey.origin) };
  }

  if (key && !partnerFromKey) {
    return {
      ok: false as const,
      status: 401,
      headers: corsHeaders(origin),
      error: "Invalid API key. Use the seminar or autism site key.",
    };
  }

  return {
    ok: true as const,
    partner: partnerFromKey,
    headers: corsHeaders(origin, origin && !partnerFromOrigin ? undefined : partnerFromKey?.origin),
  };
}

export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const partner = partnerForOrigin(origin);
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin, partner?.origin),
  });
}

export function GET(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, verified: false, error: auth.error }, { status: auth.status, headers: auth.headers });
  }

  const number = request.nextUrl.searchParams.get("number") ?? request.nextUrl.searchParams.get("certificateNumber") ?? "";
  if (!number.trim()) {
    return NextResponse.json(
      { ok: false, verified: false, error: "Add a certificate number." },
      { status: 400, headers: auth.headers }
    );
  }

  const certificate = findValidCertificate(number);
  if (!certificate) {
    return NextResponse.json(
      {
        ok: true,
        verified: false,
        source: auth.partner?.origin ?? "https://vaidyagogate.org",
      },
      { status: 200, headers: auth.headers }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      verified: true,
      source: auth.partner?.origin ?? "https://vaidyagogate.org",
      certificate: publicCertificate(certificate),
    },
    { headers: auth.headers }
  );
}
