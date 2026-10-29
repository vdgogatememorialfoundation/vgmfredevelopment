import type { Metadata } from "next";
import { findValidCertificate } from "@/lib/server/certificates";
import CertificateByNumber from "@/components/certificates/CertificateByNumber";

interface CertificatePageProps {
  params: Promise<{ certificateNumber: string }>;
}

export async function generateMetadata({
  params,
}: CertificatePageProps): Promise<Metadata> {
  const { certificateNumber } = await params;
  const certificate = findValidCertificate(certificateNumber);

  if (!certificate) return {};

  return {
    title: `Certificate ${certificate.certificateNumber}`,
    description: `Verified certificate issued by Vaidya Gogate Memorial Foundation for ${certificate.name}.`,
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function CertificateNumberPage({
  params,
}: CertificatePageProps) {
  const { certificateNumber } = await params;
  return <CertificateByNumber number={decodeURIComponent(certificateNumber)} />;
}
