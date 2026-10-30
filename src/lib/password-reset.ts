import { findAccountByIdentifier, loginBlockReason } from "@/lib/auth";
import { getAccounts, sendEmail, updateAccount } from "@/lib/admin-store";
import { issueEmailOtp, verifyEmailOtp } from "@/lib/otp";
import type { User, UserRole } from "@/types";

export type ResetRole = UserRole;

function otpRole(role: ResetRole) {
  return `reset-${role}`;
}

export function accountForReset(identifier: string, role?: ResetRole) {
  const account = findAccountByIdentifier(identifier);
  if (!account) return { error: "No account found with these details." as const };
  if (role && role !== "customer" && account.role !== role) {
    return { error: `No ${role} account found for this email.` as const };
  }
  if (role === "customer" && account.role && account.role !== "customer" && account.role !== "doctor") {
    return { error: "Use the staff or admin sign-in page for this account." as const };
  }
  const blocked = loginBlockReason(account);
  if (blocked) return { error: blocked };
  return { account };
}

export function sendPasswordResetCode(account: User, role: ResetRole) {
  const code = issueEmailOtp(account.email, otpRole(role));
  sendEmail({
    to: account.email,
    phone: account.phone,
    name: account.firstName,
    subject: "Reset your VGMF password",
    template: "custom",
    body: `Hi ${account.firstName || "there"},\n\nYour password reset code is ${code}. It expires in 10 minutes.\n\nIf you did not ask to reset your password, ignore this message.\n\n– Vaidya Gogate Memorial Foundation`,
  });
  return code;
}

export function applyPasswordReset(email: string, role: ResetRole, code: string, password: string) {
  const next = password.trim();
  if (next.length < 6) return "Use at least 6 characters.";
  const invalid = verifyEmailOtp(email, otpRole(role), code);
  if (invalid) return invalid;
  updateAccount(email, { password: next, foundationPasswordSet: true, partnerPasswordSet: false });
  return null;
}

export function changeAccountPassword(email: string, current: string, nextPassword: string) {
  const account = getAccounts().find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
  if (!account) return "Account not found.";
  const next = nextPassword.trim();
  if (next.length < 6) return "Use at least 6 characters.";
  if (account.foundationPasswordSet || !account.partnerPortals?.length) {
    if (account.password && account.password !== current) return "Current password is incorrect.";
  }
  updateAccount(email, { password: next, foundationPasswordSet: true, partnerPasswordSet: false });
  return null;
}
