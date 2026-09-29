"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, Plus, Power, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { ACCOUNT_ROLES, GROUP_LABELS, PERMISSIONS, ROLE_LABELS, ROLE_PRESETS, type AccountRole } from "@/lib/cms/modules";
import { api, downloadCsv } from "@/components/portal/api";
import type { PortalAccount } from "@/components/portal/types";

const ROLE_TONE: Record<AccountRole, string> = {
  admin: "bg-burgundy/10 text-burgundy",
  staff: "bg-peacock-light text-peacock",
  seller: "bg-sage-light text-sage",
  delivery: "bg-gold-light text-navy",
  customer: "bg-lotus-light text-lotus",
};

function PermissionPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const groups = useMemo(() => {
    const map = new Map<string, typeof PERMISSIONS>();
    for (const p of PERMISSIONS) {
      const label = p.group === "accounts" ? "Accounts" : GROUP_LABELS[p.group];
      map.set(label, [...(map.get(label) ?? []), p]);
    }
    return [...map.entries()];
  }, []);
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ROLE_PRESETS.map((preset) => (
          <button key={preset.name} type="button" title={preset.description} onClick={() => onChange([...new Set([...value, ...preset.permissions])])} className="rounded-full border border-peacock/30 bg-peacock-light px-3 py-1 text-xs font-semibold text-peacock hover:border-peacock">
            + {preset.name}
          </button>
        ))}
        <button type="button" onClick={() => onChange([])} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-muted">Clear</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(([label, perms]) => (
          <fieldset key={label} className="rounded-xl border border-border p-3">
            <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">{label}</legend>
            {perms.map((p) => (
              <label key={p.key} className="flex items-center gap-2 py-0.5 text-sm">
                <input type="checkbox" checked={value.includes(p.key)} onChange={() => toggle(p.key)} className="accent-[var(--color-burgundy)]" />
                {p.label}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    </div>
  );
}

export default function AccountsManager({ role, canManageStaff = true }: { role?: AccountRole; canManageStaff?: boolean }) {
  const [accounts, setAccounts] = useState<PortalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [credential, setCredential] = useState<{ email: string; password: string } | null>(null);
  const [editing, setEditing] = useState<PortalAccount | null>(null);
  const allowedRoles = ACCOUNT_ROLES.filter((r) => canManageStaff || !["admin", "staff"].includes(r));
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", role: (role ?? allowedRoles[0]) as AccountRole, password: "", notes: "", permissions: [] as string[] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ accounts: PortalAccount[] }>("/api/admin/accounts");
      setAccounts(res.accounts);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const visible = accounts.filter(
    (a) => (!role || a.role === role) && (!query || `${a.firstName} ${a.lastName} ${a.email} ${a.accountId} ${a.phone}`.toLowerCase().includes(query.toLowerCase()))
  );

  const create = async () => {
    setError("");
    try {
      const res = await api<{ account: PortalAccount; password: string }>("/api/admin/accounts", { method: "POST", json: form });
      setCredential({ email: res.account.email, password: res.password });
      setCreating(false);
      setForm({ ...form, firstName: "", lastName: "", email: "", phone: "", password: "", notes: "", permissions: [] });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account.");
    }
  };

  const patch = async (account: PortalAccount, body: Record<string, unknown>) => {
    setError("");
    try {
      const res = await api<{ account: PortalAccount; password?: string }>(`/api/admin/accounts/${account.id}`, { method: "PATCH", json: body });
      if (res.password) setCredential({ email: res.account.email, password: res.password });
      setAccounts((list) => list.map((a) => (a.id === account.id ? res.account : a)));
      return res.account;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update account.");
    }
  };

  const remove = async (account: PortalAccount) => {
    if (!window.confirm(`Delete ${account.email}? They will no longer be able to sign in.`)) return;
    try {
      await api(`/api/admin/accounts/${account.id}`, { method: "DELETE" });
      setAccounts((list) => list.filter((a) => a.id !== account.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account.");
    }
  };

  const title = role ? `${ROLE_LABELS[role]} accounts` : "All accounts";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">Accounts</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-text-primary">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">Every login — admin, staff, seller, delivery partner and customer — is created here. Share the generated password securely; users can change it after signing in.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => downloadCsv("accounts.csv", ["accountId", "name", "email", "phone", "role", "active", "lastLogin"], visible.map((a) => [a.accountId, `${a.firstName} ${a.lastName}`, a.email, a.phone, a.role, a.active, a.lastLoginAt]))} className="btn-outline px-4 py-2 text-sm">Export CSV</button>
          <button type="button" onClick={() => setCreating(true)} className="btn-primary px-4 py-2 text-sm"><Plus size={16} /> Create account</button>
        </div>
      </div>

      {credential && (
        <div className="rounded-2xl border border-gold/50 bg-gold-light p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-navy">Login details for {credential.email}</p>
              <p className="mt-1 text-text-muted">Password: <code className="rounded bg-white px-2 py-0.5 font-mono text-base font-bold text-burgundy">{credential.password}</code> — shown only once.</p>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => void navigator.clipboard.writeText(`Email: ${credential.email}\nPassword: ${credential.password}`)} className="rounded-lg p-2 hover:bg-white" title="Copy"><Copy size={16} /></button>
              <button type="button" onClick={() => setCredential(null)} className="rounded-lg p-2 hover:bg-white" title="Dismiss"><X size={16} /></button>
            </div>
          </div>
        </div>
      )}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      {creating && (
        <div className="rounded-2xl border border-burgundy/20 bg-white p-5 shadow-lg shadow-burgundy/5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Create account</h2>
            <button type="button" onClick={() => setCreating(false)} aria-label="Close"><X size={18} /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="input-field" placeholder="First name *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input className="input-field" placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <input className="input-field" type="email" placeholder="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input-field" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <select className="input-field" value={form.role} disabled={Boolean(role)} onChange={(e) => setForm({ ...form, role: e.target.value as AccountRole })}>
              {allowedRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <input className="input-field" placeholder="Password (leave empty to auto-generate)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <textarea className="input-field sm:col-span-2" rows={2} placeholder="Notes (department, designation…)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {form.role === "staff" && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-bold text-text-primary">Staff module access</p>
              <PermissionPicker value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />
            </div>
          )}
          <div className="mt-5 flex gap-2 border-t border-border pt-4">
            <button type="button" onClick={() => void create()} className="btn-primary px-5 py-2 text-sm">Create account</button>
            <button type="button" onClick={() => setCreating(false)} className="btn-outline px-5 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {editing && (
        <div className="rounded-2xl border border-peacock/30 bg-white p-5 shadow-lg sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Module access · {editing.firstName} {editing.lastName}</h2>
            <button type="button" onClick={() => setEditing(null)} aria-label="Close"><X size={18} /></button>
          </div>
          <PermissionPicker value={editing.permissions} onChange={(permissions) => setEditing({ ...editing, permissions })} />
          <div className="mt-5 flex gap-2 border-t border-border pt-4">
            <button type="button" onClick={async () => { if (await patch(editing, { permissions: editing.permissions })) setEditing(null); }} className="btn-primary px-5 py-2 text-sm">Save access</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-outline px-5 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="border-b border-border p-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone or Account ID…" className="input-field py-2 pl-9 text-sm" />
          </div>
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-text-muted">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">No accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border bg-warm-cream/60 text-left text-[11px] uppercase tracking-[0.12em] text-text-muted">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Contact</th>
                  <th className="px-4 py-2.5">Account ID</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Access</th>
                  <th className="px-4 py-2.5">Last login</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.id} className={`border-b border-border/60 last:border-0 ${a.active ? "" : "opacity-50"}`}>
                    <td className="px-4 py-3 font-semibold">{a.firstName} {a.lastName}<p className="text-xs font-normal text-text-muted">{a.notes}</p></td>
                    <td className="px-4 py-3 text-text-muted">{a.email}<br /><span className="text-xs">{a.phone}</span></td>
                    <td className="px-4 py-3 font-mono text-xs">{a.accountId}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ROLE_TONE[a.role]}`}>{ROLE_LABELS[a.role]}</span></td>
                    <td className="px-4 py-3 text-xs text-text-muted">{a.role === "admin" ? "Everything" : a.role === "staff" ? `${a.permissions.length} module(s)` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString("en-IN") : "Never"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {a.role === "staff" && <button type="button" title="Module access" onClick={() => setEditing(a)} className="rounded-lg p-2 text-peacock hover:bg-peacock-light"><ShieldCheck size={15} /></button>}
                        <button type="button" title="Reset password" onClick={() => { if (window.confirm(`Generate a new password for ${a.email}?`)) void patch(a, { resetPassword: true }); }} className="rounded-lg p-2 text-burgundy hover:bg-warm-cream"><KeyRound size={15} /></button>
                        <button type="button" title={a.active ? "Deactivate" : "Activate"} onClick={() => void patch(a, { active: !a.active })} className="rounded-lg p-2 text-navy hover:bg-gold-light"><Power size={15} /></button>
                        <button type="button" title="Delete" onClick={() => void remove(a)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
