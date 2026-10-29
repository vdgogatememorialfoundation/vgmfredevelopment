import type { User } from "@/types";

const ROLES_KEY = "vgmf_staff_roles";

export const staffModules = [
  { id: "orders", label: "Orders & shipments", paths: ["/admin/commerce/orders", "/admin/commerce/shipments", "/admin/shipments", "/admin/payments/refunds"] },
  { id: "pos", label: "In-store POS", paths: ["/admin/commerce/pos"] },
  { id: "catalog", label: "Products & inventory", paths: ["/admin/commerce/products", "/admin/commerce/inventory", "/admin/commerce/serviceability"] },
  { id: "payments", label: "Payments", paths: ["/admin/payments", "/admin/commerce/payments"] },
  { id: "customers", label: "Customers", paths: ["/admin/accounts/customers"] },
  { id: "website", label: "Website & homepage", paths: ["/admin/website"] },
  { id: "about", label: "About Us pages", paths: ["/admin/website/about"] },
  { id: "articles", label: "Articles", paths: ["/admin/articles"] },
  { id: "clinics", label: "Clinics", paths: ["/admin/website/clinics"] },
  { id: "events", label: "Events", paths: ["/admin/events"] },
  { id: "certificates", label: "Certificates", paths: ["/admin/certificates", "/admin/events/certificates"] },
  { id: "support", label: "Support", paths: ["/admin/support"] },
  { id: "delivery", label: "Shipping APIs", paths: ["/admin/settings/shipping-apis", "/admin/delivery-partners"] },
  { id: "communication", label: "Email & notifications", paths: ["/admin/email", "/admin/settings/notifications"] },
  { id: "staff", label: "Staff & roles", paths: ["/admin/accounts/staff", "/admin/accounts/roles"] },
  { id: "settings", label: "Site settings", paths: ["/admin/settings"] },
] as const;

export type StaffModuleId = (typeof staffModules)[number]["id"];

export interface StaffRole {
  id: string;
  name: string;
  category: string;
  description: string;
  modules: StaffModuleId[];
}

export const roleCategories = ["Content", "Events", "Commerce", "Finance", "Support", "Clinic", "Operations", "Management"];

export const defaultRoles: StaffRole[] = [
  { id: "general-staff", name: "General Staff", category: "Operations", description: "Orders, customers and support.", modules: ["orders", "customers", "support"] },
  { id: "content-editor", name: "Content Editor", category: "Content", description: "Articles, homepage, announcements and About Us.", modules: ["articles", "website", "about"] },
  { id: "event-coordinator", name: "Event Coordinator", category: "Events", description: "Events, speakers, schedule and certificates.", modules: ["events", "certificates"] },
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
  return read();
}

export function saveRoles(roles: StaffRole[]) {
  window.localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function getRole(id?: string) {
  const roles = read();
  return roles.find((role) => role.id === id) ?? roles.find((role) => role.id === "general-staff") ?? defaultRoles[0];
}

export function modulesFor(user: User | null | undefined): StaffModuleId[] | "all" {
  if (!user) return [];
  if (user.role === "admin") return "all";
  if (user.role !== "staff") return [];
  return getRole(user.staffRoleId).modules;
}

/** The most specific module that owns a path, so /admin/website/clinics belongs to Clinics and not Website. */
export function moduleForPath(path: string): StaffModuleId | null {
  let best: { id: StaffModuleId; length: number } | null = null;
  for (const moduleItem of staffModules) {
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
  return staffModules.find((item) => item.id === moduleId)?.paths[0] ?? "/admin";
}
