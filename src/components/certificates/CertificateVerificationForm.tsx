"use client";

import { useState } from "react";
import Link from "next/link";
import { verifyCertificate, type PublicCertificate } from "@/lib/certificates-client";
import { CertificateResultCard } from "@/components/certificates/CertificateResult";

type Result = {
  status: "idle" | "verified" | "invalid" | "error";
  certificateNumber: string;
  certificate?: PublicCertificate;
  message?: string;
};

export default function CertificateVerificationForm() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>({
    status: "idle",
    certificateNumber: "",
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const certificateNumber = value.trim();
    if (!certificateNumber) return;
    setBusy(true);
    try {
      const data = await verifyCertificate(certificateNumber);
      if (data.valid && data.certificate) {
        setResult({
          status: "verified",
          certificateNumber,
          certificate: data.certificate,
        });
        return;
      }
      setResult({
        status: "invalid",
        certificateNumber,
        message: data.error || "This certificate could not be verified.",
      });
    } catch (error) {
      setResult({
        status: "error",
        certificateNumber,
        message: error instanceof Error ? error.message : "Verification is temporarily unavailable. Please try again later.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <form
        id="cert-check"
        onSubmit={(event) => void handleSubmit(event)}
        className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8"
      >
        <label htmlFor="cert-id" className="block text-sm font-semibold text-text-primary">
          Certificate ID
        </label>
        <p className="mt-1 text-sm text-text-muted">
          Enter the ID printed on the certificate, such as CERT-P-12-345 or CERT-V-4-8. Older CERT-12-345
          numbers still verify. IDs are not case-sensitive. Email, phone and QR tokens are never shown.
        </p>

        <input
          id="cert-id"
          name="id"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="CERT-P-12-345"
          required
          className="input-field mt-3 text-center text-lg tracking-wider"
        />

        <button type="submit" disabled={busy} className="btn-primary mt-6 w-full disabled:opacity-50">
          {busy ? "Checking…" : "Verify"}
        </button>
      </form>

      {result.status === "verified" && result.certificate ? (
        <div className="mt-8">
          <CertificateResultCard certificate={result.certificate} />
        </div>
      ) : null}

      {result.status === "invalid" ? (
        <div className="mt-8 rounded-2xl border border-border bg-white p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-2xl text-amber-600">
            !
          </div>
          <h2 className="mt-6 font-serif text-2xl font-bold text-text-primary">Could not verify</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
            {result.message}
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs text-text-muted">
            Looked up <span className="font-semibold text-text-primary">{result.certificateNumber}</span>.
          </p>
          <Link href="/contact" className="btn-outline mt-6">
            Contact the Foundation
          </Link>
        </div>
      ) : null}

      {result.status === "error" ? (
        <p className="mt-6 text-center text-sm text-red-700">{result.message}</p>
      ) : null}
    </div>
  );
}
