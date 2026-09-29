import PortalShell from "@/components/portal/PortalShell";
import { getCurrentAccount } from "@/lib/server/auth";
import { adminNavigation } from "./_config/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = await getCurrentAccount().catch(() => null);
  return (
    <PortalShell portal="admin" account={account?.role === "admin" ? account : null} navigation={adminNavigation}>
      {children}
    </PortalShell>
  );
}
