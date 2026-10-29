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
  return formatDate(value);
}

export function CertificateResultCard({ certificate }: { certificate: PublicCertificate }) {
  const eventDate = displayDate(certificate.eventDate);
  const issueDate = displayDate(certificate.issueDate);
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-3xl text-white">✓</div>
      <h2 className="mt-6 font-serif text-2xl font-bold text-text-primary">Certificate Verified</h2>
      <p className="mt-2 text-sm text-text-muted">
        This certificate is genuine and was issued by the Vaidya Gogate Memorial Foundation
        {certificate.sourceLabel ? ` (${certificate.sourceLabel})` : ""}.
      </p>
      <dl className="mx-auto mt-8 max-w-md space-y-3 rounded-2xl border border-emerald-200 bg-white p-6 text-left text-sm">
        {row("Certificate Number", certificate.certificateNumber)}
        {row("Name", certificate.name)}
        {row("Certificate Type", certificate.certificateType || certificate.kind)}
        {row("PRN", certificate.prn)}
        {row("Application number", certificate.applicationNumber)}
        {row("Event", certificate.eventDetails?.title || certificate.event)}
        {row("Event ID", certificate.eventId)}
        {row("Event date", eventDate)}
        {row("Venue", certificate.eventDetails?.venue || certificate.eventVenue)}
        {row("Issued on", issueDate)}
        {row("Year", certificate.year ? String(certificate.year) : "")}
        {row("Programme", certificate.sourceLabel)}
        {row("Issued by", "Vaidya Gogate Memorial Foundation")}
      </dl>
    </div>
  );
}
