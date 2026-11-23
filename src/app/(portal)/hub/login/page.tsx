"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, SelectInput, TextInput } from "@/components/admin/AdminUI";

type HubOption = { code: string; name: string; type: string; city: string };

export default function HubLoginPage() {
  const router = useRouter();
  const [hubs, setHubs] = useState<HubOption[]>([]);
  const [hubCode, setHubCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/hub/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.session?.hubCode) {
          router.replace("/hub");
          return;
        }
        const list = Array.isArray(j.hubs) ? j.hubs : [];
        setHubs(list);
        if (list.length) setHubCode(list[0].code);
      })
      .catch(() => undefined);
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/hub/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "login", hubCode, email, password }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Sign in failed.");
      router.replace("/hub");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm space-y-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-burgundy">VGMF Logistics · Hub Portal</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Hub Staff Sign In</h1>
          <p className="mt-1 text-xs text-slate-500">
            Dedicated login for VGMF Hub Managers, Inward/Sorting/Bagging Operators, Dispatch Supervisors &amp; Security Staff.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        <label className="block text-xs font-bold text-slate-700">
          Select VGMF Hub
          <SelectInput className="mt-1" value={hubCode} onChange={(e) => setHubCode(e.target.value)}>
            {!hubs.length && <option value="">No hubs configured yet (add in Admin → VGMF Logistics)</option>}
            {hubs.map((h) => (
              <option key={h.code} value={h.code}>
                {h.code} — {h.name} ({h.city})
              </option>
            ))}
          </SelectInput>
        </label>

        <label className="block text-xs font-bold text-slate-700">
          Hub Staff Email / ID
          <TextInput
            className="mt-1"
            type="email"
            required
            placeholder="hubstaff@vaidyagogate.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block text-xs font-bold text-slate-700">
          Password / Hub PIN
          <TextInput
            className="mt-1"
            type="password"
            required
            placeholder="Enter password or Hub PIN"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <Button type="submit" disabled={busy || !hubCode} className="w-full">
          {busy ? "Signing in…" : "Sign In to Hub Portal"}
        </Button>
      </form>
    </div>
  );
}
