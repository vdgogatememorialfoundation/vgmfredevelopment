import { NextRequest, NextResponse } from "next/server";
import { certificatesGroupedByYear, listCertificates, publicCertificate, upsertCertificate } from "@/lib/server/certificates";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : Number.NaN;
  const event = (request.nextUrl.searchParams.get("event") ?? request.nextUrl.searchParams.get("eventSlug") ?? "").trim();
  const grouped = certificatesGroupedByYear();
  const years = Number.isFinite(year) ? grouped.filter((item) => item.year === year) : grouped;
  const filtered = event
    ? years.map((item) => ({
        ...item,
        events: item.events.filter((entry) => entry.eventSlug === event || entry.event.toLowerCase() === event.toLowerCase()),
      })).filter((item) => item.events.length)
    : years;
  return NextResponse.json({
    ok: true,
    years: filtered,
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
      eventSlug: String(body.eventSlug ?? ""),
      year: body.year ? Number(body.year) : undefined,
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
