import { NextRequest, NextResponse } from "next/server";
import { getCertificateRecord, publicCertificate, revokeCertificateRecord, upsertCertificate } from "@/lib/server/certificates";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Params) {
  const { id } = await context.params;
  const certificate = getCertificateRecord(id);
  if (!certificate || certificate.status === "Revoked") {
    return NextResponse.json({ ok: false, error: "Certificate not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, certificate: publicCertificate(certificate) });
}

export async function PATCH(request: NextRequest, context: Params) {
  const { id } = await context.params;
  const existing = getCertificateRecord(id);
  if (!existing) return NextResponse.json({ ok: false, error: "Certificate not found." }, { status: 404 });
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const certificate = upsertCertificate({
      ...existing,
      ...body,
      id: existing.id,
      name: String(body.name ?? existing.name),
      certificateNumber: String(body.certificateNumber ?? existing.certificateNumber),
      status: body.status === "Revoked" ? "Revoked" : existing.status,
      reissuedAt: typeof body.reissuedAt === "string" ? body.reissuedAt : existing.reissuedAt,
    });
    return NextResponse.json({ ok: true, certificate: publicCertificate(certificate) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: Params) {
  const { id } = await context.params;
  if (!revokeCertificateRecord(id)) return NextResponse.json({ ok: false, error: "Certificate not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
