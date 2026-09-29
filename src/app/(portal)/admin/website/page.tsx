import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { adminNavigation } from "../_config/navigation";

export default function WebsiteAdminPage() {
  const items = adminNavigation.find((g) => g.label === "Website & CMS")?.items ?? [];
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">Website & CMS</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Manage the public website</h1>
        <p className="mt-1 text-sm text-text-muted">Every module here is linked to a page on the main site.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="group flex items-center justify-between rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-burgundy/40">
            <span className="font-semibold">{item.label}</span>
            <ArrowRight size={16} className="text-burgundy transition group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}
