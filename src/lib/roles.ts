import type { User } from "@/types";

const ROLES_KEY = "vgmf_staff_roles";

export const staffModules = [
  { id: "orders", label: "Orders & shipments", paths: ["/admin/commerce/orders", "/admin/commerce/shipments", "/admin/shipments", "/admin/payments/refunds"] },
  { id: "pos", label: "In-store POS", paths: ["/admin/commerce/pos"] },
  { id: "catalog", label: "Products & inventory", paths: ["/admin/commerce/products", "/admin/commerce/inventory", "/admin/commerce/serviceability"] },
  { id: "payments", label: "Payments", paths: ["/admin/payments", "/admin/commerce/payments"] },
  { id: "customers", label: "Customers", paths: ["/admin/accounts/customers"] },
  { id: "website", label: "Website & homepage", paths: ["/admin/website", "/admin/website/pages", "/admin/website/visibility"] },
  { id: "about", label: "About Us pages", paths: ["/admin/website/about"] },
  { id: "articles", label: "Articles", paths: ["/admin/articles"] },
  { id: "clinics", label: "Clinics", paths: ["/admin/website/clinics"] },
  { id: "events", label: "Events", paths: ["/admin/events"] },
  { id: "reports", label: "Reports", paths: ["/admin/reports", "/admin/analytics"] },
  { id: "policies", label: "Policies", paths: ["/admin/website/policies"] },
  { id: "support", label: "Support", paths: ["/admin/support"] },
  { id: "analytics", label: "Analytics", paths: ["/admin/analytics"] },
  { id: "delivery", label: "Shipping APIs", paths: ["/admin/settings/shipping-apis", "/admin/delivery-partners"] },
  { id: "communication", label: "Email & notifications", paths: ["/admin/email", "/admin/settings/notifications", "/admin/settings/email", "/admin/settings/whatsapp", "/admin/settings/sms"] },
  { id: "staff", label: "Staff & roles", paths: ["/admin/accounts/staff", "/admin/accounts/roles", "/admin/accounts/doctors"] },
  { id: "settings", label: "Site settings", paths: ["/admin/settings"] },
  { id: "mobile", label: "Mobile app", paths: ["/admin/settings/mobile", "/admin/settings/appearance"] },
] as const;

export type StaffModuleId = string;

export type StaffModule = {
  id: string;
  label: string;
  paths: string[];
  custom?: boolean;
};

export interface StaffRole {
  id: string;
  name: string;
  category: string;
  description: string;
  modules: StaffModuleId[];
}

const CUSTOM_MODULES_KEY = "vgmf_custom_modules";

export function getCustomModules(): StaffModule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_MODULES_KEY);
    return raw ? (JSON.parse(raw) as StaffModule[]) : [];
  } catch {
    return [];
  }
}

export function allStaffModules(): StaffModule[] {
  return [
    ...staffModules.map((item) => ({ id: item.id, label: item.label, paths: [...item.paths] })),
    ...getCustomModules(),
  ];
}

export function saveCustomModules(modules: StaffModule[]) {
  window.localStorage.setItem(CUSTOM_MODULES_KEY, JSON.stringify(modules));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function saveCustomModule(moduleItem: StaffModule) {
  const next = getCustomModules().filter((item) => item.id !== moduleItem.id);
  next.push({ ...moduleItem, custom: true, paths: moduleItem.paths.filter(Boolean) });
  saveCustomModules(next);
}

export function removeCustomModule(id: string) {
  saveCustomModules(getCustomModules().filter((item) => item.id !== id));
}

export const roleCategories = ["Content", "Events", "Commerce", "Finance", "Support", "Clinic", "Operations", "Management"];

export const defaultRoles: StaffRole[] = [
  { id: "general-staff", name: "General Staff", category: "Operations", description: "Orders, customers and support.", modules: ["orders", "customers", "support"] },
  { id: "article-writer", name: "Article writer", category: "Content", description: "Only the Articles module — write and edit articles. New pieces wait for admin approval before they go live.", modules: ["articles"] },
  { id: "content-editor", name: "Content Editor", category: "Content", description: "Articles, homepage, announcements and About Us.", modules: ["articles", "website", "about"] },
  { id: "event-coordinator", name: "Event Coordinator", category: "Events", description: "Events, speakers and schedule.", modules: ["events"] },
  { id: "order-manager", name: "Order Manager", category: "Commerce", description: "Orders, shipping, couriers and inventory.", modules: ["orders", "pos", "catalog", "delivery", "customers"] },
  { id: "accounts", name: "Accounts & Payments", category: "Finance", description: "Payments, refunds and reconciliation.", modules: ["payments", "orders"] },
  { id: "support-agent", name: "Support Agent", category: "Support", description: "Tickets, enquiries and notifications.", modules: ["support", "communication", "customers"] },
  { id: "clinic-manager", name: "Clinic Manager", category: "Clinic", description: "Clinic page, photos and doctor profiles.", modules: ["clinics"] },
  { id: "store-manager", name: "Store Manager", category: "Management", description: "Everything in the shop.", modules: ["orders", "pos", "catalog", "payments", "customers", "delivery"] },
];

function read(): StaffRole[] {
  if (typeof window === "undefined") return defaultRoles;
  try {
    const raw = window.localStorage.getItem(ROLES_KEY);
    return raw ? (JSON.parse(raw) as StaffRole[]) : defaultRoles;
  } catch {
    return defaultRoles;
  }
}

export function getRoles() {
  const saved = read();
  if (saved.some((role) => role.id === "article-writer")) return saved;
  return [...saved, defaultRoles.find((role) => role.id === "article-writer")!];
}

export function saveRoles(roles: StaffRole[]) {
  window.localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function getRole(id?: string) {
  const roles = getRoles();
  return roles.find((role) => role.id === id) ?? roles.find((role) => role.id === "general-staff") ?? defaultRoles[0];
}

export function modulesFor(user: User | null | undefined): StaffModuleId[] | "all" {
  if (!user) return [];
  if (user.role === "admin" || user.role === "coadmin") return "all";
  if (user.role === "doctor") return ["clinics"];
  if (user.role !== "staff") return [];
  return getRole(user.staffRoleId).modules;
}

/** The most specific module that owns a path, so /admin/website/clinics belongs to Clinics and not Website. */
export function moduleForPath(path: string): StaffModuleId | null {
  let best: { id: StaffModuleId; length: number } | null = null;
  for (const moduleItem of allStaffModules()) {
    for (const prefix of moduleItem.paths) {
      if ((path === prefix || path.startsWith(`${prefix}/`)) && (!best || prefix.length > best.length)) {
        best = { id: moduleItem.id, length: prefix.length };
      }
    }
  }
  return best?.id ?? null;
}

export function canOpen(user: User | null | undefined, path: string) {
  const allowed = modulesFor(user);
  if (allowed === "all") return true;
  if (path === "/admin" || path === "/admin/") return allowed.length > 0;
  const owner = moduleForPath(path);
  return owner ? allowed.includes(owner) : false;
}

export function firstPathFor(moduleId: StaffModuleId) {
  return allStaffModules().find((item) => item.id === moduleId)?.paths[0] ?? "/admin";
}
