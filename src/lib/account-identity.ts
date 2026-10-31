import type { User } from "@/types";

/** Full international digits. Indian numbers still match with or without +91. */
export function phoneDigits(value: string | undefined | null) {
  return String(value ?? "").replace(/\D/g, "");
}

export function samePhone(left: string | undefined | null, right: string | undefined | null) {
  const a = phoneDigits(left);
  const b = phoneDigits(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const localA = a.length > 10 ? a.slice(-10) : a;
  const localB = b.length > 10 ? b.slice(-10) : b;
  return localA.length >= 10 && localA === localB;
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
