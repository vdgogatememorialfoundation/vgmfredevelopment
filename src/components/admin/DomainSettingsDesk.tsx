"use client";

import { useEffect, useMemo, useState } from "react";
import {
  dnsZoneSnippet,
  getDomainSettings,
  saveDomainSettings,
  sanitizeDomainSettings,
  type DnsRecord,
  type DnsRecordType,
  type DomainSettings,
  type EnvironmentDomain,
} from "@/lib/domains";
import { PLATFORM_APPS, PLATFORM_ENVIRONMENTS, type PlatformApp, type PlatformEnvironment } from "@/lib/platform";
import { canOpen } from "@/lib/roles";
import { useAuth } from "@/components/auth/AuthContext";

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
const primary = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const ghost = "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50";
const DNS_TYPES: DnsRecordType[] = ["A", "AAAA", "CNAME", "TXT", "MX", "NS", "CAA", "SRV"];

function Text({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <input className={input} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} autoComplete="off" />
      {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (value: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-burgundy" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <span className="font-semibold text-slate-800">{label}</span>
        {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
      </span>
    </label>
  );
}

export function DomainSettingsDesk() {
  const { user } = useAuth();
  const allowed = canOpen(user, "/admin/settings/domains");
  const [settings, setSettings] = useState<DomainSettings>(() => getDomainSettings());
  const [tab, setTab] = useState<PlatformEnvironment>("staging");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [postgres, setPostgres] = useState<boolean | null>(null);
  const zone = useMemo(() => dnsZoneSnippet(settings), [settings]);
  const env = settings.environments[tab];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/platform/domains")
      .then(async (response) => (await response.json().catch(() => null)) as { ok?: boolean; postgres?: boolean; settings?: DomainSettings } | null)
      .then((data) => {
        if (cancelled || !data?.settings) return;
        setPostgres(Boolean(data.postgres));
        const local = getDomainSettings();
        const incoming = sanitizeDomainSettings(data.settings);
        if (!local.updatedAt || (incoming.updatedAt && incoming.updatedAt >= (local.updatedAt ?? ""))) {
          setSettings(incoming);
          saveDomainSettings(incoming);
        }
      })
      .catch(() => {
        if (!cancelled) setPostgres(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!allowed) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Domain settings</h1>
        <p className="mt-2 text-sm text-slate-500">You do not have permission to edit hostnames or DNS records.</p>
      </div>
    );
  }

  const patchRoot = (patch: Partial<DomainSettings>) => setSettings((current) => sanitizeDomainSettings({ ...current, ...patch }));
  const patchEnv = (patch: Partial<EnvironmentDomain>) =>
    setSettings((current) =>
      sanitizeDomainSettings({
        ...current,
        environments: { ...current.environments, [tab]: { ...current.environments[tab], ...patch } },
      })
    );
  const patchApp = (app: PlatformApp, patch: Partial<EnvironmentDomain["apps"][PlatformApp]>) =>
    patchEnv({ apps: { ...env.apps, [app]: { ...env.apps[app], ...patch } } });

  const save = async () => {
    setBusy(true);
    setError("");
    setNote("Saving domain settings…");
    try {
      const next = saveDomainSettings(settings) ?? settings;
      setSettings(next);
      const response = await fetch("/api/platform/domains", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; postgres?: boolean; error?: string; settings?: DomainSettings } | null;
      setPostgres(Boolean(data?.postgres));
      if (!response.ok || !data?.ok) {
        setError(data?.error || "Saved in this browser. The VPS did not confirm Postgres.");
        setNote("");
        return;
      }
      if (data.settings) setSettings(sanitizeDomainSettings(data.settings));
      setNote(
        data.postgres
          ? "Saved to Postgres on this VPS and to this browser."
          : "Saved on this server’s data folder. Postgres is not connected in this process."
      );
    } catch {
      setError("Could not reach the domain settings API.");
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  const addRecord = () => {
    const record: DnsRecord = {
      id: `dns-${Date.now()}`,
      environment: tab,
      app: "platform",
      type: "A",
      host: env.hostname,
      value: settings.vpsIpv4,
      ttl: settings.defaultTtl,
      notes: "",
    };
    patchRoot({ records: [...settings.records, record] });
  };

  const updateRecord = (id: string, patch: Partial<DnsRecord>) =>
    patchRoot({ records: settings.records.map((record) => (record.id === id ? { ...record, ...patch } : record)) });

  const removeRecord = (id: string) => patchRoot({ records: settings.records.filter((record) => record.id !== id) });

  const copyZone = async () => {
    try {
      await navigator.clipboard.writeText(zone);
      setNote("DNS zone snippet copied.");
    } catch {
      setError("Could not copy. Select the snippet and copy it manually.");
    }
  };

  const visibleRecords = settings.records.filter((record) => record.environment === tab);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Domains & DNS</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Hostnames, CNAME, A records, TTL and nameservers for staging, demo and production. Staging is served at{" "}
            <strong>stagging.vaidyagogate.org</strong> (and the existing <strong>staging.vaidyagogate.org</strong> alias). Demo is a
            separate copy of all four apps at <strong>demo.vaidyagogate.org</strong>.
          </p>
        </div>
        <button type="button" className={primary} onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save domain settings"}
        </button>
      </div>
      {note ? <p className="text-sm text-emerald-700">{note}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {postgres != null ? (
        <p className="text-xs text-slate-500">{postgres ? "Postgres on this VPS is connected." : "This process has no DATABASE_URL yet; settings still save to disk."}</p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">VPS</h2>
        <p className="mt-0.5 text-sm text-slate-500">These values are the Mumbai Hostinger KVM. Change them if the server IP moves.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Text label="Apex domain" value={settings.apexDomain} onChange={(apexDomain) => patchRoot({ apexDomain })} />
          <Text label="VPS hostname" value={settings.vpsHostname} onChange={(vpsHostname) => patchRoot({ vpsHostname })} hint="CNAME target if you point hosts at the machine name." />
          <Text label="IPv4 (A record)" value={settings.vpsIpv4} onChange={(vpsIpv4) => patchRoot({ vpsIpv4 })} />
          <Text label="IPv6 (AAAA)" value={settings.vpsIpv6} onChange={(vpsIpv6) => patchRoot({ vpsIpv6 })} placeholder="optional" />
          <Text label="Default TTL (seconds)" value={settings.defaultTtl} onChange={(defaultTtl) => patchRoot({ defaultTtl: Number(defaultTtl) || 300 })} />
          <Text label="SSL / Let’s Encrypt email" value={settings.sslEmail} onChange={(sslEmail) => patchRoot({ sslEmail })} />
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Nameservers</span>
            <textarea
              className={input}
              rows={3}
              value={settings.nameservers.join("\n")}
              onChange={(event) => patchRoot({ nameservers: event.target.value.split(/\n/) })}
              placeholder="ns1.dns-parking.com&#10;ns2.dns-parking.com"
            />
            <span className="mt-1 block text-xs text-slate-400">One nameserver per line. Leave blank if Hostinger DNS stays at the registrar.</span>
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {PLATFORM_ENVIRONMENTS.map((item) => (
          <button
            key={item}
            type="button"
            className={item === tab ? primary : ghost}
            onClick={() => setTab(item)}
          >
            {settings.environments[item].label}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">{env.label} host</h2>
        <p className="mt-0.5 text-sm text-slate-500">Hostname, aliases, CNAME target and whether search engines may index this copy.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Text label="Hostname" value={env.hostname} onChange={(hostname) => patchEnv({ hostname })} hint="FQDN visitors type, without https://" />
          <Text label="Canonical URL" value={env.canonicalUrl} onChange={(canonicalUrl) => patchEnv({ canonicalUrl })} />
          <Text
            label="Alias hostnames"
            value={env.aliasHostnames.join(", ")}
            onChange={(value) => patchEnv({ aliasHostnames: value.split(",") })}
            hint="Comma-separated. Staging should keep staging.vaidyagogate.org because that A record already exists."
          />
          <Text label="WWW hostname" value={env.wwwHostname} onChange={(wwwHostname) => patchEnv({ wwwHostname })} placeholder="www.vaidyagogate.org" />
          <Text label="A record IPv4" value={env.ipv4} onChange={(ipv4) => patchEnv({ ipv4 })} />
          <Text label="AAAA IPv6" value={env.ipv6} onChange={(ipv6) => patchEnv({ ipv6 })} />
          <Text label="CNAME host" value={env.cnameHost} onChange={(cnameHost) => patchEnv({ cnameHost })} hint="The left-hand name in a CNAME record." />
          <Text label="CNAME target" value={env.cnameTarget} onChange={(cnameTarget) => patchEnv({ cnameTarget })} hint="Usually the VPS hostname. Do not CNAME the apex." />
          <Text label="TTL (seconds)" value={env.ttl} onChange={(ttl) => patchEnv({ ttl: Number(ttl) || 300 })} />
          <Text label="SSL email" value={env.sslEmail} onChange={(sslEmail) => patchEnv({ sslEmail })} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Check label="Force HTTPS" checked={env.forceHttps} onChange={(forceHttps) => patchEnv({ forceHttps })} hint="Nginx redirects HTTP to HTTPS once a certificate is issued." />
          <Check
            label="Allow search indexing"
            checked={env.indexPublic}
            onChange={(indexPublic) => patchEnv({ indexPublic })}
            hint="Staging and demo stay noindex."
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Four apps on {env.label}</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Customer, admin, staff and support share this Next.js process. Each app has its own Postgres folder under
          /VGMF-PLATFORM/postgres/{tab}/.
        </p>
        <div className="mt-4 grid gap-4">
          {PLATFORM_APPS.map((app) => (
            <div key={app} className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-3">
              <Text label={`${app} hostname`} value={env.apps[app].hostname} onChange={(hostname) => patchApp(app, { hostname })} />
              <Text label="Start path" value={env.apps[app].path} onChange={(path) => patchApp(app, { path })} />
              <Text label="Public URL" value={env.apps[app].publicUrl} onChange={(publicUrl) => patchApp(app, { publicUrl })} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-900">DNS records</h2>
            <p className="mt-0.5 text-sm text-slate-500">A, AAAA, CNAME, TXT, MX, NS, CAA, SRV. Add these at the registrar for {settings.apexDomain}.</p>
          </div>
          <button type="button" className={ghost} onClick={addRecord}>
            Add record
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-2 pr-2">Type</th>
                <th className="pb-2 pr-2">Host</th>
                <th className="pb-2 pr-2">Value</th>
                <th className="pb-2 pr-2">TTL</th>
                <th className="pb-2 pr-2">App</th>
                <th className="pb-2 pr-2">Notes</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => (
                <tr key={record.id} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-2">
                    <select className={input} value={record.type} onChange={(event) => updateRecord(record.id, { type: event.target.value as DnsRecordType })}>
                      {DNS_TYPES.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input className={input} value={record.host} onChange={(event) => updateRecord(record.id, { host: event.target.value })} />
                  </td>
                  <td className="py-2 pr-2">
                    <input className={input} value={record.value} onChange={(event) => updateRecord(record.id, { value: event.target.value })} />
                  </td>
                  <td className="py-2 pr-2">
                    <input className={input} value={record.ttl} onChange={(event) => updateRecord(record.id, { ttl: Number(event.target.value) || 300 })} />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className={input}
                      value={record.app}
                      onChange={(event) => updateRecord(record.id, { app: event.target.value as DnsRecord["app"] })}
                    >
                      <option value="platform">platform</option>
                      {PLATFORM_APPS.map((app) => (
                        <option key={app}>{app}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input className={input} value={record.notes ?? ""} onChange={(event) => updateRecord(record.id, { notes: event.target.value })} />
                  </td>
                  <td className="py-2">
                    <button type="button" className="text-xs font-semibold text-red-700" onClick={() => removeRecord(record.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-900">Zone snippet</h2>
            <p className="mt-0.5 text-sm text-slate-500">Paste into Hostinger DNS or bind. Prefer an A record to {settings.vpsIpv4}; do not also CNAME the same host.</p>
          </div>
          <button type="button" className={ghost} onClick={() => void copyZone()}>
            Copy
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{zone}</pre>
      </section>
    </div>
  );
}
