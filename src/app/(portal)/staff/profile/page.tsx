"use client";

import ClientOnly from "@/components/common/ClientOnly";
import { StaffProfile } from "@/components/admin/StaffProfile";

export default function StaffProfilePage() {
  return (
    <ClientOnly>
      <StaffProfile />
    </ClientOnly>
  );
}
