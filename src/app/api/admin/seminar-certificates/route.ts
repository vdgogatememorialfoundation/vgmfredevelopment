import { NextRequest, NextResponse } from "next/server";
import { denyUnlessPortal } from "@/lib/server/portal-auth";
import { listSeminarCertificates, seminarCertificatesConfigured } from "@/lib/server/seminar-certificates";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = denyUnlessPortal(request);
  if (denied) return denied;
  if (!seminarCertificatesConfigured()) {
    return NextResponse.json({ ok: false, configured: false, error: "The seminar database link (SEMINAR_DATABASE_URL) is not set on this server." });
  }
  try {
    const certificates = (await listSeminarCertificates()) ?? [];
    return NextResponse.json({ ok: true, configured: true, certificates }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, configured: true, error: `Could not read seminar certificates: ${(error as Error).message}` }, { status: 502 });
  }
}
