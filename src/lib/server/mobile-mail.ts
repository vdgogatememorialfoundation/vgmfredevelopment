import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { applyFoundationBrand, wrapFoundationEmail } from "@/lib/email-layout";
import { readKv } from "@/lib/server/db";
import { sendMsg91Sms, sendTransactionalEmail } from "@/lib/server/providers";

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

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Sends an OTP by MSG91 SMS when MSG91 is saved in Admin → SMS. Returns false when SMS is not set up or fails. */
export async function sendMobileSmsOtp(phone: string, code?: string) {
  if (!code || phone.replace(/\D/g, "").length < 10) return false;
  const notify = asRecord(await readKv<Record<string, unknown>>("admin", "notify-creds"));
  const sms = asRecord(notify.sms);
  if (sms.provider && sms.provider !== "msg91") return false;
  try {
    const sent = await sendMsg91Sms(sms, {
      to: phone,
      otp: code,
      body: `${code} is your Vaidya Gogate Memorial Foundation verification code. It expires in 10 minutes.`,
    });
    return Boolean(sent);
  } catch {
    return false;
  }
}

export async function sendMobileEmail(to: string, subject: string, body: string) {
  const stored = asRecord(await readKv<Record<string, unknown>>("admin", "email-creds"));
  const notify = asRecord(await readKv<Record<string, unknown>>("admin", "notify-creds"));
  const creds = { ...readMobileEmailCreds(), ...asRecord(notify.email), ...stored };
  const html = wrapFoundationEmail(
    applyFoundationBrand(body)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>")
  );
  const mail = { to, subject, html };
  return sendTransactionalEmail(creds, mail);
}
