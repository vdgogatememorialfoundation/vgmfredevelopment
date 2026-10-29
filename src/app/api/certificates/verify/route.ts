import { NextRequest, NextResponse } from "next/server";
import { findValidCertificate, publicCertificate } from "@/lib/server/certificates";
import { partnerForKey, partnerForOrigin, readApiKey } from "@/lib/partner-keys";
import { lookupPartnerCertificate } from "@/lib/server/partner-certificates";
import { sourceLabel } from "@/lib/partner-certificates";

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

export async function GET(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, verified: false, error: auth.error }, { status: auth.status, headers: auth.headers });
  }

  const number =
    request.nextUrl.searchParams.get("number") ??
    request.nextUrl.searchParams.get("certificateNumber") ??
    request.nextUrl.searchParams.get("id") ??
    "";
  if (!number.trim()) {
    return NextResponse.json(
      { ok: false, verified: false, valid: false, error: "Add a certificate number." },
      { status: 400, headers: auth.headers }
    );
  }

  const certificate = findValidCertificate(number);
  if (certificate) {
    return NextResponse.json(
      {
        ok: true,
        verified: true,
        valid: true,
        status: "valid",
        source: "foundation",
        sourceLabel: sourceLabel("foundation"),
        certificate: { ...publicCertificate(certificate), source: "foundation", sourceLabel: sourceLabel("foundation") },
      },
      { headers: auth.headers }
    );
  }

  if (!auth.partner) {
    const partner = await lookupPartnerCertificate(number);
    if (partner.certificate) {
      return NextResponse.json(
        {
          ok: true,
          verified: true,
          valid: true,
          status: "valid",
          source: partner.certificate.source,
          sourceLabel: partner.certificate.sourceLabel,
          certificate: partner.certificate,
        },
        { headers: auth.headers }
      );
    }
    const httpStatus =
      partner.code === "INVALID_ID" || partner.status === "invalid_id"
        ? 400
        : partner.code === "AMBIGUOUS"
          ? 409
          : partner.code === "RATE_LIMITED"
            ? 429
            : partner.code === "UNAVAILABLE" || partner.status === "unavailable"
              ? 500
              : partner.code === "NOT_ISSUED" || partner.code === "NOT_FOUND"
                ? 404
                : 200;
    return NextResponse.json(
      {
        ok: false,
        verified: false,
        valid: false,
        status: partner.status || "not_found",
        code: partner.code,
        error: partner.error || "This certificate could not be verified.",
        source: "https://vaidyagogate.org",
      },
      { status: httpStatus, headers: auth.headers }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      verified: false,
      valid: false,
      status: "not_found",
      source: auth.partner?.origin ?? "https://vaidyagogate.org",
    },
    { status: 200, headers: auth.headers }
  );
}
