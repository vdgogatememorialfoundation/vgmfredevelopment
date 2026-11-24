"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminHubDashboard from "@/components/admin/AdminHubDashboard";

type HubSession = {
  hubCode: string;
  hubName: string;
  email: string;
  name: string;
  role: string;
};

export default function HubPortalPage() {
  const router = useRouter();
  const [session, setSession] = useState<HubSession | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void fetch("/api/hub/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j.session?.hubCode) {
          router.replace("/hub/login");
          return;
        }
        setSession(j.session);
      })
      .finally(() => setChecking(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/hub/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.replace("/hub/login");
  };

  if (checking || !session) {
    return <div className="p-8 text-sm text-slate-500">Loading Hub Portal…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div>
          <span className="font-extrabold text-burgundy">VGMF HUB PORTAL</span>
          <span className="ml-2 text-slate-600">
            Signed in as <b>{session.name}</b> ({session.role.replace(/_/g, " ")}) · Hub <b className="font-mono">{session.hubCode}</b>
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="rounded-lg border border-slate-300 px-3 py-1 font-bold text-slate-700 hover:bg-slate-100"
        >
          Sign Out
        </button>
      </div>
      <AdminHubDashboard lockedHubCode={session.hubCode} operatorName={session.name} />
    </div>
  );
}
