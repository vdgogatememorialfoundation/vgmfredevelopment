import type { AccountRole } from "@/lib/cms/modules";

export interface PortalAccount {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: AccountRole;
  permissions: string[];
  active: boolean;
  notes: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface NavGroup {
  label: string;
  items: { label: string; href: string }[];
}
