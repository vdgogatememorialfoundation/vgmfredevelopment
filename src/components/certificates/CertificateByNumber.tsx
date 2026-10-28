"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { findIssuedCertificate } from "@/lib/cms";
import { formatDate } from "@/lib/utils";

export default function CertificateByNumber({ number }: { number: string }) {
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const certificate = ready ? findIssuedCertificate(number) : undefined;

  if (!ready) return null;
  if (!certificate) {
    return (
      <main className="section bg-background">
        <div className="container max-w-2xl text-center">
          <h1 className="text-3xl font-bold text-text-primary">Certificate Not Found</h1>
          <p className="mt-3 text-sm text-text-muted">No certificate matches {number.toUpperCase()}.</p>
          <Link href="/certificate-verification" className="btn-outline mt-8">Verify Another Certificate</Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <section className="section bg-background">
        <div className="container max-w-2xl">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-3xl text-white">
              ✓
            </div>

            <h1 className="mt-6 text-3xl font-bold text-text-primary">
              Certificate Verified
            </h1>

            <p className="mt-3 text-sm text-text-muted">
              This certificate is recorded as issued by the Vaidya Gogate
              Memorial Foundation.
            </p>

            <dl className="mx-auto mt-10 grid max-w-md gap-4 rounded-2xl border border-emerald-200 bg-white p-8 text-left">
              <CertificateRow
                label="Certificate Number"
                value={certificate.certificateNumber}
              />
              <CertificateRow label="Name" value={certificate.name} />
              <CertificateRow label="Event" value={certificate.event} />
              <CertificateRow
                label="Certificate Type"
                value={certificate.certificateType}
              />
              <CertificateRow
                label="Event Date"
                value={formatDate(certificate.eventDate)}
              />
              <CertificateRow
                label="Issue Date"
                value={formatDate(certificate.issueDate)}
              />
              <CertificateRow
                label="Signed by"
                value={certificate.signature}
              />
            </dl>

            <Link href="/certificate-verification" className="btn-outline mt-8">
              Verify Another Certificate
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function CertificateRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.1em] text-text-muted">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-text-primary">{value}</dd>
    </div>
  );
}