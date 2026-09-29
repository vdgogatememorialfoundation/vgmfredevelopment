"use client";

import { useState } from "react";
import { getSettings } from "@/lib/admin-store";
import { useAuth } from "@/components/auth/AuthContext";

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [settings] = useState(() => getSettings());
  const { user } = useAuth();

  const { maintenanceMode, maintenanceMessage } = settings;

  if (!maintenanceMode || user?.role === "admin" || user?.role === "staff") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-warm-cream/40 px-6 text-center">
      <div className="max-w-md rounded-3xl border border-border bg-white p-10 shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-burgundy text-xs font-bold text-white">
          VGMF
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">
          Undergoing maintenance
        </p>
        <h1 className="mt-2 text-3xl font-bold text-text-primary">
          We will be back shortly
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">{maintenanceMessage}</p>
      </div>
    </div>
  );
}