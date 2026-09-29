import AccountsManager from "@/components/portal/AccountsManager";
import { canAccess, getCurrentAccount } from "@/lib/server/auth";

export default async function StaffAccountsPage() {
  const account = await getCurrentAccount().catch(() => null);
  if (!account) return null;
  if (!canAccess(account, "accounts")) {
    return <p className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-text-muted">You do not have access to accounts.</p>;
  }
  return <AccountsManager canManageStaff={account.role === "admin"} />;
}
