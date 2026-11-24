"use client";

import AdminReturnsDesk from "@/components/admin/AdminReturnsDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function AdminReplacementsPage() {
  return (
    <ClientOnly>
      <AdminReturnsDesk defaultSection="replacement" />
    </ClientOnly>
  );
}
