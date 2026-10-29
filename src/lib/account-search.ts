import { displayName } from "@/lib/admin-store";
import type { DeliveryAddress, User, UserRole } from "@/types";

export function matchesAccountQuery(account: User, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  const phone = (account.phone || "").replace(/\D/g, "");
  const haystack = [
    displayName(account),
    account.firstName,
    account.middleName,
    account.lastName,
    account.email,
    account.phone,
    account.accountId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (haystack.includes(q)) return true;
  return digits.length >= 3 && phone.includes(digits);
}

export function filterAccounts(
  accounts: User[],
  query: string,
  role?: UserRole | "customer"
) {
  return accounts.filter((account) => {
    const matchesRole =
      role === undefined
        ? true
        : role === "customer"
          ? !account.role || account.role === "customer"
          : account.role === role;
    return matchesRole && matchesAccountQuery(account, query);
  });
}

export function accountToDelivery(account: User, current?: Partial<DeliveryAddress>): DeliveryAddress {
  return {
    fullName: displayName(account, true) || current?.fullName || "",
    phone: account.phone || current?.phone || "",
    email: account.email || current?.email || "",
    line1: account.address?.line1 || current?.line1 || "",
    landmark: account.address?.landmark || current?.landmark || "",
    city: account.address?.city || current?.city || "",
    state: account.address?.state || current?.state || "Maharashtra",
    pincode: account.address?.pincode || current?.pincode || "",
    country: account.address?.country || current?.country || "India",
    countryCode: account.address?.countryCode || current?.countryCode || "IN",
  };
}
