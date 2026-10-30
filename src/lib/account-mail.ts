import { getAllAccounts, getSession } from "@/lib/auth";
import { queueNotification } from "@/lib/notify";
import type { AccountActivity } from "@/lib/activity";

const CARE = "care@vaidyagogate.org";

function nameOf(email: string) {
  const account = getAllAccounts().find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!account) return email;
  return [account.firstName, account.lastName].filter(Boolean).join(" ") || email;
}

export function emailAccountActivity(row: AccountActivity) {
  if (typeof window === "undefined") return;
  if (row.kind === "created") return;
  const account = getAllAccounts().find((item) => item.email.toLowerCase() === row.email.toLowerCase());
  const to = account?.email || row.email;
  if (!to || !to.includes("@")) return;
  const name = nameOf(to);
  const labels: Record<AccountActivity["kind"], string> = {
    login: "signed in",
    logout: "signed out",
    created: "was created",
    updated: "was updated",
    disabled: "was disabled",
    banned: "was banned",
    reactivated: "was reactivated",
    deleted: "was deleted",
    password: "had its password changed",
  };
  const action = labels[row.kind] ?? row.kind;
  const when = new Date(row.at).toLocaleString("en-IN");
  const extra = row.detail ? `\n\nNote: ${row.detail}` : "";
  const by = row.by && row.by !== "system" ? `\nChanged by: ${row.by}` : "";
  queueNotification({
    to,
    phone: account?.phone,
    name,
    subject: `VGMF account ${row.kind}: ${name}`,
    template: "account-activity",
    replyTo: CARE,
    body: `Dear ${name},\n\nYour VGMF account ${action} on ${when}.${by}${extra}\n\nIf this was not you, write to ${CARE}.\n\n– Vaidya Gogate Memorial Foundation`,
  });
}

export function staffReplyTo() {
  try {
    const session = getSession();
    const chosen = session?.replyToEmail?.trim();
    if (chosen && chosen.includes("@")) return chosen;
    if (session?.email) {
      const account = getAllAccounts().find((item) => item.email.toLowerCase() === session.email.toLowerCase());
      const fromProfile = account?.replyToEmail?.trim();
      if (fromProfile && fromProfile.includes("@")) return fromProfile;
    }
  } catch {
    /* ignore */
  }
  return CARE;
}
