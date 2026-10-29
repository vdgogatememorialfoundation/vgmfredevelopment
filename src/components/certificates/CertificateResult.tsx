import type { PublicCertificate } from "@/lib/certificates-client";
import { formatDate } from "@/lib/utils";

function row(label: string, value?: string) {
  if (!value) return null;
  return (
    <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-semibold text-text-primary">{value}</dd>
    </div>
  );
}

function displayDate(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  return formatDate(value);
}

export function CertificateResultCard({ certificate }: { certificate: PublicCertificate }) {
  const eventTitle = certificate.eventDetails?.title || certificate.event;
  const eventDate = displayDate(certificate.eventDetails?.date || certificate.eventDate);
  const typeLabel = certificate.typeLabel || certificate.certificateType || certificate.kind;
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-3xl text-white">✓</div>
      <h2 className="mt-6 font-serif text-2xl font-bold text-text-primary">Certificate Verified</h2>
      <p className="mt-2 text-sm text-text-muted">
        Valid {typeLabel} certificate for <span className="font-semibold text-text-primary">{certificate.name}</span>
        {eventTitle ? ` — ${eventTitle}` : ""}
        {certificate.certificateNumber ? ` (${certificate.certificateNumber}).` : "."}
      </p>
      <dl className="mx-auto mt-8 max-w-md space-y-3 rounded-2xl border border-emerald-200 bg-white p-6 text-left text-sm">
        {row("Certificate ID", certificate.certificateNumber)}
        {row("Holder", certificate.name)}
        {row("Type", typeLabel)}
        {row("Event", eventTitle)}
        {row("Event date", eventDate)}
        {row("Application number", certificate.applicationNumber)}
        {row("Participant ID", certificate.participantId)}
        {row("PRN", certificate.prn)}
        {row("Issued on", displayDate(certificate.issuedAt || certificate.issueDate))}
        {row("Issued by", certificate.issuer || certificate.signature || "Vaidya Gogate Memorial Foundation")}
        {row("Programme", certificate.sourceLabel)}
      </dl>
    </div>
  );
}
