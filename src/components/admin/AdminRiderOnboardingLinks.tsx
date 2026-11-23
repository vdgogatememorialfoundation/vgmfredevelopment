"use client";

import { useEffect, useState } from "react";
import { Button, SelectInput, TextInput } from "@/components/admin/AdminUI";

type Link = { token: string; label: string; hubCode: string; active: boolean; createdAt: string; signups: number; url: string };

/** Admin: unique sign-up links where delivery agents register and complete KYC on the website. */
export default function AdminRiderOnboardingLinks() {
  const [links, setLinks] = useState<Link[]>([]);
  const [hubs, setHubs] = useState<{ code: string; name: string }[]>([]);
  const [label, setLabel] = useState("");
  const [hubCode, setHubCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetch("/api/admin/rider-onboarding")
      .then((x) => x.json())
      .then((r) => {
        if (!r?.ok) return;
        setLinks(r.links);
        setHubs(r.hubs);
      })
      .catch(() => null);
  }, []);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    const r = await fetch("/api/admin/rider-onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json()).catch(() => null);
    if (r?.ok) setLinks(r.links);
    setBusy(false);
  };

  return (
    <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/50 p-3.5 space-y-3">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-teal-950">Delivery agent sign-up links</p>
        <p className="text-[11px] text-teal-900/80">Share a link. Agents sign up, verify their email and complete VOVE ID KYC on the website. When you activate them, a 5-digit user ID and password are emailed to them automatically.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <TextInput className="w-56" placeholder="Link name (e.g. Pune riders Nov)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <SelectInput className="w-48" value={hubCode} onChange={(e) => setHubCode(e.target.value)}>
          <option value="">Agent chooses the hub</option>
          {hubs.map((h) => <option key={h.code} value={h.code}>{h.name} ({h.code})</option>)}
        </SelectInput>
        <Button disabled={busy} onClick={() => void post({ label, hubCode }).then(() => setLabel(""))}>Create link</Button>
      </div>
      {links.length ? (
        <div className="space-y-2">
          {links.map((l) => (
            <div key={l.token} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white p-2 text-[11px]">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{l.label} · {l.hubCode || "any hub"} · {l.signups} sign-up{l.signups === 1 ? "" : "s"} · <span className={l.active ? "text-green-700" : "text-red-700"}>{l.active ? "On" : "Off"}</span></p>
                <p className="truncate font-mono text-text-muted">{l.url}</p>
              </div>
              <Button variant="ghost" onClick={() => void navigator.clipboard.writeText(l.url).then(() => setCopied(l.token))}>{copied === l.token ? "Copied" : "Copy link"}</Button>
              <Button variant="ghost" disabled={busy} onClick={() => void post({ action: "toggle", token: l.token, active: !l.active })}>{l.active ? "Switch off" : "Switch on"}</Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
