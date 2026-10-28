"use client";

import { AccountsSection } from "@/components/admin/AdminAccounts";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <AccountsSection />
    </ClientOnly>
  );
}
