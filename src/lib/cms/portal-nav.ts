import { GROUP_LABELS, MODULES, permissionOf, type GroupKey } from "@/lib/cms/modules";

export interface PortalNavGroup {
  label: string;
  items: { label: string; href: string; description?: string }[];
}

/** Sidebar for a staff member: one entry per module view they are permitted to use. */
export function staffNavigation(role: string, permissions: string[]): PortalNavGroup[] {
  const allowed = (key: string) => role === "admin" || permissions.includes(key);
  const groups = new Map<GroupKey | "accounts", PortalNavGroup["items"]>();
  for (const m of MODULES) {
    if (m.startInCreate || !allowed(permissionOf(m))) continue;
    groups.set(m.group, [...(groups.get(m.group) ?? []), { label: m.label, href: `/staff/m/${m.key}`, description: m.description }]);
  }
  const nav: PortalNavGroup[] = [{ label: "Overview", items: [{ label: "Dashboard", href: "/staff" }] }];
  for (const [group, items] of groups) nav.push({ label: group === "accounts" ? "Accounts" : GROUP_LABELS[group], items });
  if (allowed("accounts")) {
    nav.push({ label: "Accounts", items: [{ label: "Customer & seller accounts", href: "/staff/accounts", description: "Create customer, seller and delivery logins." }] });
  }
  return nav;
}
