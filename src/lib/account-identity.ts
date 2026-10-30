import type { User } from "@/types";

/** Last 10 digits so +91 and leading zeros still match. */
export function phoneDigits(value: string | undefined | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function samePhone(left: string | undefined | null, right: string | undefined | null) {
  const a = phoneDigits(left);
  const b = phoneDigits(right);
  return Boolean(a && b && a === b);
}

export function accountMatchesIdentifier(
  account: Pick<User, "email" | "phone" | "whatsapp" | "alternatePhone" | "accountId">,
  identifier: string
) {
  const value = identifier.trim().toLowerCase();
  if (!value) return false;
  if (account.email.toLowerCase() === value) return true;
  if (account.accountId && account.accountId === identifier.trim()) return true;
  if (samePhone(account.phone, identifier)) return true;
  if (account.alternatePhone && samePhone(account.alternatePhone, identifier)) return true;
  if (account.whatsapp && samePhone(account.whatsapp, identifier)) return true;
  return false;
}

export const ACCOUNT_EXISTS_MESSAGE =
  "An account with this email or phone is already created. Please login.";
