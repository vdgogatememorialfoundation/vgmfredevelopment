"use client";

import { StaffAccountsDesk } from "@/components/admin/StaffRoles";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <StaffAccountsDesk />
    </ClientOnly>
  );
}
