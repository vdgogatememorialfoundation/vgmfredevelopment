"use client";

import { AdminConsole } from "@/components/admin/AdminConsole";

export default function StaffPage() {
  return (
    <main className="min-h-screen bg-background">
      <AdminConsole role="staff" />
    </main>
  );
}