import type { ReactNode } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F7F7F5] text-slate-900">
      <AdminSidebar />

      <div className="lg:pl-64">
        <AdminHeader />

        <main className="p-5 sm:p-7 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
