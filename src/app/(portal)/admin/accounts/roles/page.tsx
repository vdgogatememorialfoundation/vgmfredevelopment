"use client";

import { RolesDesk } from "@/components/admin/StaffRoles";
import { ModuleAccessDesk } from "@/components/admin/PublishingDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function Page() {
  return (
    <ClientOnly>
      <div className="space-y-10">
        <RolesDesk />
        <ModuleAccessDesk />
      </div>
    </ClientOnly>
  );
}
