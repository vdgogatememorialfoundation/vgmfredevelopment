"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Result = {
  status: "idle" | "verified" | "not-found";
  certificateNumber: string;
};

export default function CertificateVerificationForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<Result>({
    status: "idle",
    certificateNumber: "",
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const certificateNumber = value.trim();

    if (!certificateNumber) return;

    router.push(`/certificate-verification/${encodeURIComponent(certificateNumber)}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8"
      >
        <label
          htmlFor="certificate-number"
          className="block text-sm font-semibold text-text-primary"
        >
          Certificate Number
        </label>

        <input
          id="certificate-number"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="e.g. VGMF-CERT-2026-0001"
          className="input-field mt-3 text-center text-lg tracking-wider"
          aria-describedby="certificate-help"
        />

        <p id="certificate-help" className="mt-3 text-center text-sm text-text-muted">
          Enter the certificate number printed on your certificate, or scan
          the QR code on the certificate.
        </p>

        <button type="submit" className="btn-primary mt-6 w-full">
          Verify Certificate
        </button>
      </form>

      {result.status === "verified" && (
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-3xl text-white">
            ✓
          </div>

          <h2 className="mt-6 text-2xl font-bold text-text-primary">
            Certificate Verified
          </h2>

          <p className="mt-2 text-sm text-text-muted">
            The following certificate is genuine and was issued by the
            Vaidya Gogate Memorial Foundation.
          </p>

          <dl className="mx-auto mt-8 max-w-md space-y-3 rounded-2xl border border-emerald-200 bg-white p-6 text-left text-sm">
            <CertificateRow
              label="Certificate Number"
              value={result.certificateNumber.toUpperCase()}
            />
            <CertificateRow label="Certificate Type" value="Participation" />
            <CertificateRow label="Issued By" value="Vaidya Gogate Memorial Foundation" />
          </dl>
        </div>
      )}

      {result.status === "not-found" && (
        <div className="mt-8 rounded-2xl border border-border bg-white p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-2xl text-amber-600">
            !
          </div>

          <h2 className="mt-6 text-2xl font-bold text-text-primary">
            Certificate Not Found
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
            We could not find a certificate matching{" "}
            <span className="font-semibold text-text-primary">
              {result.certificateNumber}
            </span>
            . Please check the number and try again.
          </p>

          <Link href="/contact" className="btn-outline mt-6">
            Contact the Foundation
          </Link>
        </div>
      )}
    </div>
  );
}

function CertificateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-semibold text-text-primary">{value}</dd>
    </div>
  );
}