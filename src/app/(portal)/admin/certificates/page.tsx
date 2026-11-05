"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { CertificateRegistry } from "@/components/admin/OperationsDesk";
import { SeminarCertificates } from "@/components/admin/SeminarCertificates";

export default function Page() {
  return (
    <ClientOnly>
      <CertificateRegistry mode="list" />
      <SeminarCertificates />
    </ClientOnly>
  );
}
