"use client";

import AdminReturnsDesk from "@/components/admin/AdminReturnsDesk";
import ClientOnly from "@/components/common/ClientOnly";

export default function AdminReturnsPage() {
  return (
    <ClientOnly>
      <AdminReturnsDesk defaultSection="return" />
    </ClientOnly>
  );
}
