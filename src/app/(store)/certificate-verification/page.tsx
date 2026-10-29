import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import CertificateVerificationForm from "@/components/certificates/CertificateVerificationForm";

export const metadata: Metadata = {
  title: "Certificate Verification",
  description:
    "Verify the authenticity of certificates issued by Vaidya Gogate Memorial Foundation using the certificate number or QR code.",
};

export default function CertificateVerificationPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Verification"
        title="Certificate Verification"
        description="Check a Foundation, seminar or autism programme certificate by the unique id printed on it."
      />

      <section className="section bg-background">
        <div className="container">
          <CertificateVerificationForm />
        </div>
      </section>
    </main>
  );
}