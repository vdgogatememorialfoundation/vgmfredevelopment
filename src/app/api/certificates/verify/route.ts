import { NextRequest, NextResponse } from "next/server";
import { getCertificate } from "@/data/content";
import { partnerForKey, partnerSites } from "@/lib/partner-keys";

function corsHeaders(origin: string | null) {
  const headers = new Headers();
  const allowed = partnerSites.some((site) => site.origin === origin);
  if (origin && allowed) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Headers", "x-api-key, content-type");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Vary", "Origin");
  return headers;
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export function GET(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"));
  const apiKey = request.headers.get("x-api-key") ?? "";
  const partner = partnerForKey(apiKey);
  if (!partner) {
    return NextResponse.json(
      { ok: false, error: "Invalid API key. Use the seminar or autism site key." },
      { status: 401, headers }
    );
  }
  const number = request.nextUrl.searchParams.get("number") ?? "";
  const certificate = getCertificate(number);
  if (!certificate) {
    return NextResponse.json(
      { ok: true, verified: false, source: partner.origin },
      { status: 404, headers }
    );
  }
  return NextResponse.json(
    { ok: true, verified: true, source: partner.origin, certificate },
    { headers }
  );
}
