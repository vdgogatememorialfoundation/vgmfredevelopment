import { NextRequest, NextResponse } from "next/server";
import { listCertificates, publicCertificate, upsertCertificate } from "@/lib/server/certificates";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    certificates: listCertificates().filter((certificate) => certificate.status !== "Revoked").map(publicCertificate),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const certificateNumber = String(body.certificateNumber ?? body.number ?? "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "Add the recipient name." }, { status: 400 });
    if (!certificateNumber) return NextResponse.json({ ok: false, error: "Add a certificate number." }, { status: 400 });
    const certificate = upsertCertificate({
      id: typeof body.id === "string" ? body.id : undefined,
      name,
      certificateNumber,
      event: String(body.event ?? ""),
      certificateType: String(body.certificateType ?? "Participation"),
      eventDate: String(body.eventDate ?? ""),
      issueDate: String(body.issueDate ?? ""),
      signature: String(body.signature ?? ""),
      status: body.status === "Revoked" ? "Revoked" : "Valid",
      reissuedAt: typeof body.reissuedAt === "string" ? body.reissuedAt : undefined,
    });
    return NextResponse.json({ ok: true, certificate: publicCertificate(certificate) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}
