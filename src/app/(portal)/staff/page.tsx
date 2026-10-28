"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import ClientOnly from "@/components/common/ClientOnly";

function StaffEntry() {
  const router = useRouter();
  const { user } = useAuth();
  const ready = user?.role === "staff" || user?.role === "admin";

  useEffect(() => {
    if (ready) router.replace("/admin");
  }, [ready, router]);

  if (ready) return <p className="p-10 text-center text-sm text-text-muted">Opening your workspace…</p>;
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-border bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-text-primary">Staff workspace</h1>
        <p className="mt-2 text-sm text-text-muted">Sign in with the staff account an administrator created for you.</p>
        <Link href="/staff/login" className="btn-primary mt-6">Staff sign in</Link>
      </div>
    </div>
  );
}

export default function StaffPage() {
  return (
    <ClientOnly>
      <StaffEntry />
    </ClientOnly>
  );
}
