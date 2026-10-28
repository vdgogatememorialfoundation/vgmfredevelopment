"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { CertificateRegistry } from "@/components/admin/OperationsDesk";

export default function Page() {
  return (
    <ClientOnly>
      <CertificateRegistry mode="reissue" />
    </ClientOnly>
  );
}
