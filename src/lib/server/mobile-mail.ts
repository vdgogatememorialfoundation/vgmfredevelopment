import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { sendTransactionalEmail } from "@/lib/server/providers";

const FILE = join("/tmp", "vgmf-mobile-email.json");

export type MobileEmailCreds = {
  provider?: "zeptomail" | "zoho";
  fromAddress?: string;
  fromName?: string;
  zeptoToken?: string;
  zeptoHost?: string;
  zohoClientId?: string;
  zohoClientSecret?: string;
  zohoRefreshToken?: string;
  zohoAccountId?: string;
  zohoDomain?: string;
};

export function saveMobileEmailCreds(creds: MobileEmailCreds | null | undefined) {
  if (!creds || typeof creds !== "object") return;
  const hasSecret = Boolean(creds.zeptoToken || creds.zohoClientSecret || creds.zohoRefreshToken);
  if (!hasSecret) return;
  const next = { ...readMobileEmailCreds(), ...creds };
  try {
    mkdirSync("/tmp", { recursive: true });
    writeFileSync(FILE, JSON.stringify(next));
  } catch {
    /* ephemeral host */
  }
}

export function readMobileEmailCreds(): MobileEmailCreds {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as MobileEmailCreds;
  } catch {
    return {};
  }
}

export async function sendMobileEmail(to: string, subject: string, body: string) {
  const creds = readMobileEmailCreds();
  const html = `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#0B1F3A">${body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")}</div>`;
  const mail = { to, subject, html };
  return sendTransactionalEmail(creds, mail);
}
