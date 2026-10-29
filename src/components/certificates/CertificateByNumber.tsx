"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { verifyCertificate, type PublicCertificate } from "@/lib/certificates-client";
import { CertificateResultCard } from "@/components/certificates/CertificateResult";

export default function CertificateByNumber({ number }: { number: string }) {
  const [certificate, setCertificate] = useState<PublicCertificate | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    verifyCertificate(number)
      .then((data) => {
        if (cancelled) return;
        if (data.valid && data.certificate) {
          setCertificate(data.certificate);
          setError("");
          return;
        }
        setCertificate(null);
        setError(data.error || "This certificate could not be verified.");
      })
      .catch(() => {
        if (!cancelled) {
          setCertificate(null);
          setError("Verification is temporarily unavailable. Please try again later.");
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [number]);

  if (!ready) {
    return (
      <main className="section bg-background">
        <div className="container max-w-2xl text-center text-sm text-text-muted">Checking…</div>
      </main>
    );
  }

  if (!certificate) {
    return (
      <main className="section bg-background">
        <div className="container max-w-2xl text-center">
          <h1 className="font-serif text-3xl font-bold text-text-primary">Could not verify</h1>
          <p className="mt-3 text-sm text-text-muted">{error}</p>
          <Link href="/certificate-verification" className="btn-outline mt-8">
            Verify another certificate
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <section className="section bg-background">
        <div className="container max-w-2xl">
          <CertificateResultCard certificate={certificate} />
          <div className="mt-8 text-center">
            <Link href="/certificate-verification" className="btn-outline">
              Verify another certificate
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
