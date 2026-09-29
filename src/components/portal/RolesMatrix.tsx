import Link from "next/link";
import { GROUP_LABELS, PERMISSIONS, ROLE_LABELS, ROLE_PRESETS, ACCOUNT_ROLES } from "@/lib/cms/modules";

const ROLE_INFO: Record<string, string> = {
  admin: "Full access to every module, all accounts and settings.",
  staff: "Signs in at /staff and sees only the modules the admin grants.",
  seller: "Signs in at /seller to manage their listings and orders.",
  delivery: "Delivery partner login for assigned shipments.",
  customer: "Website account for the shop, events and certificates.",
};

export default function RolesMatrix() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">Accounts</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Roles &amp; Permissions</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">Accounts are created only by administrators. Staff access is granted per module — use a preset when creating a staff account, then fine-tune it.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {ACCOUNT_ROLES.map((role) => (
          <div key={role} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <p className="font-display text-lg font-semibold text-burgundy">{ROLE_LABELS[role]}</p>
            <p className="mt-1 text-sm text-text-muted">{ROLE_INFO[role]}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="font-display text-xl font-semibold">Staff presets</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-text-muted">
                <th className="py-2 pr-3">Module</th>
                <th className="py-2 pr-3">Area</th>
                {ROLE_PRESETS.map((p) => <th key={p.name} className="px-2 py-2 text-center">{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((perm) => (
                <tr key={perm.key} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{perm.label}</td>
                  <td className="py-2 pr-3 text-xs text-text-muted">{perm.group === "accounts" ? "Accounts" : GROUP_LABELS[perm.group]}</td>
                  {ROLE_PRESETS.map((p) => (
                    <td key={p.name} className="px-2 py-2 text-center">{p.permissions.includes(perm.key) ? <span className="text-sage">●</span> : <span className="text-border">○</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link href="/admin/accounts/staff" className="btn-primary mt-5 px-4 py-2 text-sm">Create a staff account</Link>
      </div>
    </div>
  );
}
