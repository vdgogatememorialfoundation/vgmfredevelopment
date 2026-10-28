"use client";

import { useState } from "react";
import { createUserAccount, ensureBootstrapped, getAccounts, removeAccount, updateAccount } from "@/lib/admin-store";
import { getRoles, roleCategories, saveRoles, staffModules, type StaffModuleId, type StaffRole } from "@/lib/roles";
import { slugify } from "@/lib/cms";
import type { User } from "@/types";

ensureBootstrapped();

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const primary = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const ghost = "rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700";

const blankRole = (): StaffRole => ({ id: "", name: "", category: roleCategories[0], description: "", modules: [] });

export function RolesDesk() {
  const [roles, setRoles] = useState<StaffRole[]>(() => getRoles());
  const [draft, setDraft] = useState<StaffRole>(blankRole);
  const [message, setMessage] = useState("");
  const staff = getAccounts().filter((account) => account.role === "staff");

  const toggle = (id: StaffModuleId) =>
    setDraft((current) => ({
      ...current,
      modules: current.modules.includes(id) ? current.modules.filter((item) => item !== id) : [...current.modules, id],
    }));

  const save = () => {
    if (!draft.name.trim()) return setMessage("Give the role a name.");
    if (!draft.modules.length) return setMessage("Tick at least one module.");
    const role = { ...draft, name: draft.name.trim(), id: draft.id || slugify(draft.name) };
    const next = [...roles.filter((item) => item.id !== role.id), role];
    saveRoles(next);
    setRoles(next);
    setDraft(blankRole());
    setMessage(`Saved ${role.name}. Staff with this role see these modules the next time they open a page.`);
  };

  const remove = (id: string) => {
    if (staff.some((account) => (account.staffRoleId ?? "general-staff") === id)) {
      setMessage("Move the staff in this role to another role first.");
      return;
    }
    const next = roles.filter((item) => item.id !== id);
    saveRoles(next);
    setRoles(next);
  };

  const byCategory = roleCategories
    .map((category) => ({ category, roles: roles.filter((role) => role.category === category) }))
    .filter((group) => group.roles.length);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Roles & permissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Group roles by category and tick the modules each role can open. Staff sign in at /staff/login and only see these modules.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">{draft.id ? `Edit ${draft.name}` : "New role"}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input className={field} placeholder="Role name, e.g. Seminar Desk" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <select className={field} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
            {roleCategories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <input className={field} placeholder="What this role does" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {staffModules.map((moduleItem) => (
            <label key={moduleItem.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={draft.modules.includes(moduleItem.id)} onChange={() => toggle(moduleItem.id)} />
              {moduleItem.label}
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={primary} onClick={save}>{draft.id ? "Update role" : "Create role"}</button>
          {draft.id && <button type="button" className={ghost} onClick={() => setDraft(blankRole())}>Cancel</button>}
        </div>
        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      </section>

      {byCategory.map((group) => (
        <section key={group.category}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{group.category}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {group.roles.map((role) => {
              const members = staff.filter((account) => (account.staffRoleId ?? "general-staff") === role.id);
              return (
                <li key={role.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{role.name}</p>
                      <p className="text-xs text-slate-500">{role.description}</p>
                    </div>
                    <div className="flex gap-3 text-sm font-semibold">
                      <button type="button" className="text-burgundy" onClick={() => setDraft(role)}>Edit</button>
                      <button type="button" className="text-slate-400" onClick={() => remove(role.id)}>Delete</button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {role.modules.map((id) => (
                      <span key={id} className="rounded-full bg-[#F4F1EA] px-2.5 py-0.5 text-xs text-slate-700">
                        {staffModules.find((item) => item.id === id)?.label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {members.length ? members.map((member) => `${member.firstName} ${member.lastName}`).join(", ") : "No staff in this role yet."}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function StaffAccountsDesk() {
  const roles = getRoles();
  const [accounts, setAccounts] = useState<User[]>(() => getAccounts().filter((account) => account.role === "staff" || account.role === "admin"));
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", staffRoleId: roles[0]?.id ?? "general-staff" });
  const [message, setMessage] = useState("");
  const refresh = () => setAccounts(getAccounts().filter((account) => account.role === "staff" || account.role === "admin"));

  const create = () => {
    if (!form.firstName || !form.email || !form.phone) return setMessage("Name, email and phone are required.");
    if (form.password.length < 6) return setMessage("Set a password of at least 6 characters.");
    if (getAccounts().some((account) => account.email.toLowerCase() === form.email.trim().toLowerCase())) {
      return setMessage("An account with this email already exists.");
    }
    createUserAccount({ ...form, email: form.email.trim(), role: "staff" });
    setMessage(`Created. ${form.firstName} can sign in at /staff/login with ${form.email.trim()} and the password you set.`);
    setForm({ ...form, firstName: "", lastName: "", email: "", phone: "", password: "" });
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Staff accounts</h1>
        <p className="mt-1 text-sm text-slate-500">Each staff member gets one role. The role decides which admin modules they can open.</p>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Add staff user</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input className={field} placeholder="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
          <input className={field} placeholder="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          <input className={field} placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <input className={field} placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <input className={field} type="password" placeholder="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <select className={field} value={form.staffRoleId} onChange={(event) => setForm({ ...form, staffRoleId: event.target.value })}>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.category} · {role.name}</option>
            ))}
          </select>
        </div>
        <button type="button" className={`${primary} mt-4`} onClick={create}>Create staff user</button>
        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      </section>

      <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {accounts.map((account) => (
          <StaffRow key={account.email} account={account} roles={roles} onChange={refresh} />
        ))}
      </ul>
    </div>
  );
}

function StaffRow({ account, roles, onChange }: { account: User; roles: StaffRole[]; onChange: () => void }) {
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const isAdmin = account.role === "admin";
  return (
    <li className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="font-semibold text-slate-900">{account.firstName} {account.lastName}</p>
        <p className="text-xs text-slate-500">{account.email} · {account.phone}</p>
      </div>
      {isAdmin ? (
        <span className="text-sm font-semibold text-burgundy">Administrator · all modules</span>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            value={account.staffRoleId ?? "general-staff"}
            onChange={(event) => {
              updateAccount(account.email, { staffRoleId: event.target.value });
              setNote("Role updated.");
              onChange();
            }}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.category} · {role.name}</option>
            ))}
          </select>
          <input className="w-36 rounded-lg border border-slate-200 px-3 py-1.5 text-sm" type="password" placeholder="New password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button
            type="button"
            className={ghost}
            onClick={() => {
              if (password.length < 6) return setNote("Use 6+ characters.");
              updateAccount(account.email, { password });
              setPassword("");
              setNote("Password changed.");
            }}
          >
            Set password
          </button>
          <button
            type="button"
            className="text-sm font-semibold text-red-600"
            onClick={() => {
              removeAccount(account.email);
              onChange();
            }}
          >
            Remove
          </button>
          {note && <span className="text-xs text-emerald-700">{note}</span>}
        </div>
      )}
    </li>
  );
}
