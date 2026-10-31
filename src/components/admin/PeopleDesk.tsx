"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createUserAccount,
  displayName,
  getAccounts,
  removeAccount,
  sendAccountDetails,
  sendPeopleEmail,
  setAccountStatus,
  updateAccount,
} from "@/lib/admin-store";
import { matchesAccountQuery } from "@/lib/account-search";
import { activitiesFor, currentActorEmail, recordActivity, type AccountActivity } from "@/lib/activity";
import { getSession } from "@/lib/auth";
import { subscribeCms } from "@/lib/cms";
import { generatePassword } from "@/lib/passwords";
import { getRoles, type StaffRole } from "@/lib/roles";
import type { AccountStatus, User, UserRole } from "@/types";
import { AdminModal } from "@/components/admin/AdminModal";
import { PartnerPortalBadges } from "@/components/account/PartnerPortalBadges";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const primary = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const ghost = "rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700";

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  disabled: "bg-amber-50 text-amber-800",
  banned: "bg-red-50 text-red-700",
};

type PeopleRole = Extract<UserRole, "staff" | "doctor">;

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  staffRoleId: "general-staff",
  asCoadmin: false,
};

function refreshRole(role: PeopleRole) {
  return getAccounts().filter((account) => (role === "staff" ? account.role === "staff" || account.role === "coadmin" : account.role === role));
}

export function PeopleDesk({ role }: { role: PeopleRole }) {
  const roles = getRoles();
  const [accounts, setAccounts] = useState<User[]>(() => refreshRole(role));
  const [form, setForm] = useState({ ...emptyForm });
  const [message, setMessage] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [mail, setMail] = useState({ subject: "", body: "" });
  const [mailNote, setMailNote] = useState("");
  const label = role === "staff" ? "staff" : "doctor";
  const people = role === "staff" ? "staff" : "doctors";
  const loginPath = role === "staff" ? "/staff/login" : "/doctor/login";
  const refresh = () => setAccounts(refreshRole(role));
  useEffect(() => subscribeCms(refresh), [role]);
  const shown = useMemo(
    () => accounts.filter((account) => matchesAccountQuery(account, query)),
    [accounts, query]
  );
  const selected = accounts.find((account) => account.email === selectedEmail) ?? null;
  const selectedEmails = Object.entries(picked).filter(([, on]) => on).map(([email]) => email);
  const mailRecipients = selectedEmails.length
    ? accounts.filter((account) => selectedEmails.includes(account.email))
    : shown;

  const sendMail = (recipients: User[]) => {
    if (!mail.subject.trim() || !mail.body.trim()) {
      setMailNote("Add a subject and message.");
      return;
    }
    if (recipients.length === 0) {
      setMailNote(`No ${people} accounts to email.`);
      return;
    }
    const count = sendPeopleEmail(recipients, mail.subject, mail.body);
    setMailNote(`Queued ${count} email${count === 1 ? "" : "s"}.`);
  };

  const create = () => {
    if (!form.firstName.trim() || !form.email.trim() || !form.phone.trim()) {
      setMessage("Name, email and phone are required.");
      return;
    }
    if (getAccounts().some((account) => account.email.toLowerCase() === form.email.trim().toLowerCase())) {
      setMessage("An account with this email already exists.");
      return;
    }
    const createdRole = role === "staff" && form.asCoadmin ? "coadmin" : role;
    const created = createUserAccount({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: createdRole,
      staffRoleId: createdRole === "staff" ? form.staffRoleId : undefined,
    });
    setMessage(`Created. ${created.firstName} can sign in at ${loginPath}${createdRole === "coadmin" ? " as a co-administrator" : ""}. The password was emailed to ${created.email}.`);
    setForm({ ...emptyForm, staffRoleId: form.staffRoleId });
    refresh();
    setCreating(false);
    setSelectedEmail(created.email);
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{role === "staff" ? "Staff & co-admin accounts" : "Doctor accounts"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Search by name, phone or email. Co-administrators sign in on the staff portal with full module access.
          </p>
        </div>
        <button type="button" className={primary} onClick={() => setCreating(true)}>
          + Add {label}
        </button>
      </div>

      {creating && (
        <AdminModal title={`Add ${label}`} wide onClose={() => setCreating(false)}>
        <div className="grid gap-3 sm:grid-cols-3">
          <input className={field} placeholder="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
          <input className={field} placeholder="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          <input className={field} placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <input className={field} placeholder="Phone with country code" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          {role === "staff" && !form.asCoadmin && (
            <select className={field} value={form.staffRoleId} onChange={(event) => setForm({ ...form, staffRoleId: event.target.value })}>
              {roles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.category} · {item.name}
                </option>
              ))}
            </select>
          )}
          {role === "staff" && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.asCoadmin}
                onChange={(event) => setForm({ ...form, asCoadmin: event.target.checked })}
              />
              Co-administrator (full access, signs in at /staff)
            </label>
          )}
        </div>
        <button type="button" className={`${primary} mt-4`} onClick={create}>
          Create {label} account
        </button>
        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
        </AdminModal>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Email {people}</h2>
        <p className="mt-1 text-sm text-slate-500">
          Send a single mail to the selected accounts, or a bulk mail to everyone matching the search. Use {"{name}"} to insert each person’s name.
        </p>
        <div className="mt-3 grid gap-3">
          <input className={field} placeholder="Subject" value={mail.subject} onChange={(event) => setMail({ ...mail, subject: event.target.value })} />
          <textarea className={field} rows={4} placeholder="Message" value={mail.body} onChange={(event) => setMail({ ...mail, body: event.target.value })} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={primary} onClick={() => sendMail(mailRecipients.filter((account) => selectedEmails.includes(account.email)))} disabled={selectedEmails.length === 0}>
            Email selected ({selectedEmails.length})
          </button>
          <button type="button" className={ghost} onClick={() => sendMail(shown)}>
            Email all shown ({shown.length})
          </button>
        </div>
        {mailNote && <p className="mt-3 text-sm text-emerald-700">{mailNote}</p>}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className={field}
          placeholder={`Search ${people} by name, phone or email`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className={`${ghost} shrink-0`}
          onClick={() => {
            const allOn = shown.length > 0 && shown.every((account) => picked[account.email]);
            setPicked(allOn ? {} : Object.fromEntries(shown.map((account) => [account.email, true])));
          }}
        >
          {shown.length > 0 && shown.every((account) => picked[account.email]) ? "Clear selection" : "Select shown"}
        </button>
      </div>

      <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {shown.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500">{accounts.length === 0 ? `No ${label} accounts yet.` : `No ${label}s match that search.`}</li>}
        {shown.map((account) => (
          <PeopleRow
            key={account.email}
            account={account}
            roles={roles}
            checked={Boolean(picked[account.email])}
            onToggle={(on) => setPicked((current) => ({ ...current, [account.email]: on }))}
            onChange={refresh}
            onView={() => {
              setSelectedEmail(account.email);
              setEditing(false);
            }}
            onEdit={() => {
              setSelectedEmail(account.email);
              setEditing(true);
            }}
            onEmail={() => {
              setPicked({ [account.email]: true });
              setMail((current) => ({
                subject: current.subject || `Message from VGMF`,
                body: current.body,
              }));
              setMailNote(`Selected ${displayName(account)} for a single email. Add a subject and message above.`);
            }}
          />
        ))}
      </ul>

      {selected && (
        <AdminModal title={editing ? "Edit account" : "Account"} wide onClose={() => setSelectedEmail(null)}>
          <AccountDetail
            account={selected}
            roles={roles}
            editing={editing}
            onClose={() => setSelectedEmail(null)}
            onEdit={() => setEditing(true)}
            onSaved={() => {
              refresh();
              setEditing(false);
            }}
          />
        </AdminModal>
      )}
    </div>
  );
}

function PeopleRow({
  account,
  roles,
  checked,
  onToggle,
  onChange,
  onView,
  onEdit,
  onEmail,
}: {
  account: User;
  roles: StaffRole[];
  checked: boolean;
  onToggle: (on: boolean) => void;
  onChange: () => void;
  onView: () => void;
  onEdit: () => void;
  onEmail: () => void;
}) {
  const [reveal, setReveal] = useState(false);
  const [note, setNote] = useState("");
  const status = account.status ?? "active";
  const isSelf = getSession()?.email.toLowerCase() === account.email.toLowerCase();
  const lastLogin = activitiesFor(account.email).find((row) => row.kind === "login");

  const changeStatus = (next: AccountStatus) => {
    let reason: string | undefined;
    if (next !== "active") {
      const answer = window.prompt(`Reason to ${next === "banned" ? "ban" : "disable"} ${account.email}:`, "");
      if (answer === null) return;
      reason = answer.trim() || undefined;
    }
    setAccountStatus(account.email, next, reason);
    setNote(next === "active" ? "Reactivated." : next === "banned" ? "Banned." : "Disabled.");
    onChange();
  };

  return (
    <li className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1.5"
            checked={checked}
            onChange={(event) => onToggle(event.target.checked)}
            aria-label={`Select ${displayName(account)}`}
          />
          <div>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
            {displayName(account)}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${STATUS_TONE[status]}`}>{status}</span>
            <PartnerPortalBadges user={account} />
          </p>
          <p className="text-xs text-slate-500">
            {account.email} · {account.phone}
            {account.accountId ? ` · ID ${account.accountId}` : ""}
            {account.role === "coadmin" ? " · Co-administrator" : ""}
            {account.role === "staff" ? ` · ${roles.find((item) => item.id === (account.staffRoleId ?? "general-staff"))?.name ?? "Staff"}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Password: {reveal ? <span className="font-mono">{account.password || "—"}</span> : "••••••••"}{" "}
            <button type="button" className="font-semibold text-burgundy" onClick={() => setReveal((open) => !open)}>
              {reveal ? "Hide" : "Show"}
            </button>
          </p>
          <p className="text-xs text-slate-400">Last login: {lastLogin ? new Date(lastLogin.at).toLocaleString("en-IN") : "Never"}</p>
          {account.statusReason && status !== "active" && <p className="text-xs text-red-600">Reason: {account.statusReason}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={ghost} onClick={onView}>View</button>
          <button type="button" className={ghost} onClick={onEdit}>Edit</button>
          <button type="button" className={ghost} onClick={onEmail}>Email</button>
          <button type="button" className={ghost} onClick={() => { sendAccountDetails(account.email); setNote("Login details emailed."); }}>
            Email login
          </button>
          {status === "active" ? (
            <>
              <button type="button" className={ghost} disabled={isSelf} onClick={() => changeStatus("disabled")}>Disable</button>
              <button type="button" className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700" disabled={isSelf} onClick={() => changeStatus("banned")}>Ban</button>
            </>
          ) : (
            <button type="button" className={ghost} onClick={() => changeStatus("active")}>Reactivate</button>
          )}
          <button
            type="button"
            className="text-sm font-semibold text-red-600 disabled:opacity-40"
            disabled={isSelf}
            onClick={() => {
              if (!window.confirm(`Delete ${account.email}? This cannot be undone.`)) return;
              removeAccount(account.email);
              onChange();
            }}
          >
            Delete
          </button>
        </div>
      </div>
      {note && <p className="text-xs text-emerald-700">{note}</p>}
    </li>
  );
}

function AccountDetail({
  account,
  roles,
  editing,
  onClose,
  onEdit,
  onSaved,
}: {
  account: User;
  roles: StaffRole[];
  editing: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSaved: () => void;
}) {
  const activity = useMemo(() => activitiesFor(account.email), [account.email, account.lastLoginAt, account.password, account.status]);
  const [draft, setDraft] = useState({
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    phone: account.phone,
    staffRoleId: account.staffRoleId ?? "general-staff",
    password: "",
  });
  const [note, setNote] = useState("");
  const [mail, setMail] = useState({ subject: "", body: "" });
  const lastLogin = activity.find((row) => row.kind === "login");
  const lastLogout = activity.find((row) => row.kind === "logout");

  const save = () => {
    updateAccount(account.email, {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      whatsapp: draft.phone.trim(),
      staffRoleId: account.role === "staff" ? draft.staffRoleId : undefined,
      password: draft.password.trim() || account.password,
    });
    recordActivity({ email: draft.email.trim() || account.email, kind: "updated", by: currentActorEmail(), detail: "Profile updated" });
    setNote("Account updated.");
    onSaved();
  };

  const resetPassword = () => {
    const password = generatePassword();
    updateAccount(account.email, { password });
    recordActivity({ email: account.email, kind: "password", by: currentActorEmail(), detail: "Password reset" });
    setDraft({ ...draft, password: "" });
    sendAccountDetails(draft.email.trim() || account.email);
    setNote("A new password was emailed.");
    onSaved();
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{editing ? "Edit account" : "Account details"}</h2>
          <p className="text-sm text-slate-500">{displayName(account)} · {account.role}</p>
          <PartnerPortalBadges user={account} className="mt-2" />
        </div>
        <div className="flex gap-2">
          {!editing && <button type="button" className={ghost} onClick={onEdit}>Edit</button>}
          <button type="button" className={ghost} onClick={onClose}>Close</button>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input className={field} value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} />
          <input className={field} value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} />
          <input className={field} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
          <input className={field} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
          {account.role === "staff" && (
            <select className={field} value={draft.staffRoleId} onChange={(event) => setDraft({ ...draft, staffRoleId: event.target.value })}>
              {roles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.category} · {item.name}
                </option>
              ))}
            </select>
          )}
          <input className={field} type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder="Leave blank to keep the current password" autoComplete="new-password" />
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button type="button" className={primary} onClick={save}>Save changes</button>
            <button type="button" className={ghost} onClick={resetPassword}>Reset password and email</button>
          </div>
        </div>
      ) : (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Account ID" value={account.accountId ?? "—"} />
          <Detail label="Email" value={account.email} />
          <Detail label="Phone" value={account.phone} />
          <Detail label="Password" value="••••••••" />
          <Detail label="Status" value={account.status ?? "active"} />
          <Detail label="Created" value={account.createdAt ? new Date(account.createdAt).toLocaleString("en-IN") : "—"} />
          <Detail label="Last login" value={lastLogin ? new Date(lastLogin.at).toLocaleString("en-IN") : "Never"} />
          <Detail label="Last logout" value={lastLogout ? new Date(lastLogout.at).toLocaleString("en-IN") : "—"} />
        </dl>
      )}
      {note && <p className="mt-3 text-sm text-emerald-700">{note}</p>}

      <div className="mt-6 rounded-lg border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Email {displayName(account)}</h3>
        <div className="mt-3 grid gap-2">
          <input className={field} placeholder="Subject" value={mail.subject} onChange={(event) => setMail({ ...mail, subject: event.target.value })} />
          <textarea className={field} rows={3} placeholder="Message" value={mail.body} onChange={(event) => setMail({ ...mail, body: event.target.value })} />
        </div>
        <button
          type="button"
          className={`${primary} mt-3`}
          onClick={() => {
            if (!mail.subject.trim() || !mail.body.trim()) {
              setNote("Add a subject and message.");
              return;
            }
            sendPeopleEmail([account], mail.subject, mail.body);
            setNote(`Email queued to ${account.email}.`);
            setMail({ subject: "", body: "" });
          }}
        >
          Send email
        </button>
      </div>

      <h3 className="mt-6 text-sm font-semibold uppercase tracking-wider text-slate-400">Activity</h3>
      <ul className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-100">
        {activity.length === 0 && <li className="px-4 py-6 text-sm text-slate-500">No login or account activity recorded yet.</li>}
        {activity.map((row) => (
          <ActivityRow key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function ActivityRow({ row }: { row: AccountActivity }) {
  return (
    <li className="flex flex-col gap-0.5 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-medium capitalize text-slate-900">{row.kind}</span>
      <span className="text-slate-500">{row.detail || (row.by ? `by ${row.by}` : "")}</span>
      <span className="text-xs text-slate-400">{new Date(row.at).toLocaleString("en-IN")}</span>
    </li>
  );
}
