import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { sendZeptoMail, sendZohoMail } from "@/lib/server/providers";

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
  try {
    mkdirSync("/tmp", { recursive: true });
    writeFileSync(FILE, JSON.stringify(creds));
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
  const sent =
    creds.provider === "zoho" ? await sendZohoMail(creds, mail) : await sendZeptoMail(creds, mail);
  return sent;
}
