"use client";

import { useState } from "react";
import {
  createUserAccount,
  ensureBootstrapped,
  getAccounts,
  seedAccounts,
} from "@/lib/admin-store";
import type { User } from "@/types";
import {
  Button,
  EmptyState,
  Field,
  Panel,
  SelectInput,
  StatusBadge,
  TextInput,
} from "@/components/admin/AdminUI";

ensureBootstrapped();

const ROLE_TONES: Record<string, string> = {
  customer: "bg-warm-cream text-burgundy",
  staff: "bg-amber-50 text-amber-700",
  admin: "bg-burgundy/10 text-burgundy",
  seller: "bg-emerald-50 text-emerald-700",
};

export function AccountsSection() {
  const [accounts, setAccounts] = useState<User[]>(() => getAccounts());
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "customer" as "customer" | "admin" | "staff",
  });
  const [added, setAdded] = useState("");
  const refresh = () => setAccounts(getAccounts());

  const submit = () => {
    seedAccounts();
    if (!form.firstName || !form.lastName || !form.email || !form.phone) return;
    const created = createUserAccount(form);
    setAdded(`${created.accountId} (${created.role})`);
    refresh();
    setForm({ firstName: "", lastName: "", email: "", phone: "", role: "customer" });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Accounts & Users</h1>
        <p className="text-sm text-text-muted">
          Create customer, staff and admin accounts. Login credentials are sent via email.
        </p>
      </div>

      <Panel title="Create account" description="New accounts can sign in at /login using email, phone or Account ID." action={added ? <span className="text-xs font-semibold text-emerald-700">Created Account ID {added}</span> : undefined}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name"><TextInput value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
          <Field label="Last name"><TextInput value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
          <Field label="Email"><TextInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Role">
            <SelectInput value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}>
              <option value="customer">Customer</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </SelectInput>
          </Field>
        </div>
        <div className="mt-4">
          <Button onClick={submit}>Create account</Button>
        </div>
      </Panel>

      <Panel title={`Accounts (${accounts.length})`}>
        {accounts.length === 0 ? (
          <EmptyState text="No accounts yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-text-muted">
                  <th className="py-2 pr-3">Name</th>
                  <th className="px-3">Contact</th>
                  <th className="px-3">Account ID</th>
                  <th className="px-3">Role</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id || account.email} className="border-b border-border/60">
                    <td className="py-2.5 pr-3 font-medium text-text-primary">{account.firstName} {account.lastName}</td>
                    <td className="px-3 text-text-muted">{account.email}<br /><span className="text-xs">{account.phone}</span></td>
                    <td className="px-3 font-mono text-xs">{account.accountId ?? "—"}</td>
                    <td className="px-3"><StatusBadge status={account.role ?? "customer"} mapping={ROLE_TONES} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}