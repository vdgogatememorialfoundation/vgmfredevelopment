import PortalDashboard from "@/components/portal/PortalDashboard";
import { getCurrentAccount } from "@/lib/server/auth";
import { staffNavigation } from "@/lib/cms/portal-nav";

export default async function StaffPage() {
  const account = await getCurrentAccount().catch(() => null);
  if (!account) return null;
  const shortcuts = staffNavigation(account.role, account.permissions)
    .slice(1)
    .flatMap((g) => g.items)
    .slice(0, 10)
    .map((i) => ({ label: i.label, href: i.href, description: i.description ?? "" }));
  return <PortalDashboard account={account} base="/staff" shortcuts={shortcuts} />;
}
