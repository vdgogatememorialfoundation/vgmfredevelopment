import Link from "next/link";
import { notFound } from "next/navigation";
import ModulePage from "@/components/portal/ModulePage";
import { getModule } from "@/lib/cms/modules";
import { canAccessModule, getCurrentAccount } from "@/lib/server/auth";

export default async function StaffModulePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!getModule(key)) notFound();
  const account = await getCurrentAccount().catch(() => null);
  if (!account) return null;
  if (!canAccessModule(account, key)) {
    return (
      <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <h1 className="font-display text-2xl font-semibold">No access</h1>
        <p className="mt-2 text-sm text-text-muted">The administrator has not granted you access to this module.</p>
        <Link href="/staff" className="btn-primary mt-5 px-4 py-2 text-sm">Back to dashboard</Link>
      </div>
    );
  }
  return <ModulePage moduleKey={key} />;
}
