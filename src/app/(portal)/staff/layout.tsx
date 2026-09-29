import PortalShell from "@/components/portal/PortalShell";
import { getCurrentAccount } from "@/lib/server/auth";
import { staffNavigation } from "@/lib/cms/portal-nav";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const account = await getCurrentAccount().catch(() => null);
  const allowed = account && (account.role === "staff" || account.role === "admin") ? account : null;
  return (
    <PortalShell portal="staff" account={allowed} navigation={allowed ? staffNavigation(allowed.role, allowed.permissions) : []}>
      {children}
    </PortalShell>
  );
}
