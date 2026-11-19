import { readFileSync, writeFileSync } from "node:fs";
import { indiaToday } from "@/lib/festival-themes";
import { isBirthday, normalizeBirthday } from "@/lib/site-extras";
import { accountsWithBirthday } from "@/lib/server/accounts";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import { dataFile } from "@/lib/server/paths";

const FILE = dataFile("birthday-wishes.json");
let started = false;
let running = false;

function sentLog(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Emails each member once on their birthday (India date), after 8 am IST. */
export async function sendBirthdayWishes(now = new Date()) {
  if (running) return;
  running = true;
  try {
    const hourIst = (now.getUTCHours() + 5 + (now.getUTCMinutes() + 30 >= 60 ? 1 : 0)) % 24;
    if (hourIst < 8) return;
    const settings = normalizeBirthday(readMobileFeed().siteText?.birthday);
    if (!settings.enabled || !settings.email) return;
    const today = indiaToday(now);
    const log = sentLog();
    let changed = false;
    for (const account of accountsWithBirthday(today, isBirthday)) {
      if (log[account.accountId] === today || !account.email) continue;
      const name = account.firstName || "friend";
      const result = await sendMobileEmail(
        account.email,
        `Happy birthday, ${name}!`,
        `Dear ${name},\n\n${settings.message.replace(/\{name\}/g, name)}\n\nWarm wishes,\nVaidya Gogate Memorial Foundation`
      ).catch(() => null);
      if (result) {
        log[account.accountId] = today;
        changed = true;
      }
    }
    if (changed) writeFileSync(FILE, JSON.stringify(log, null, 2));
  } finally {
    running = false;
  }
}

export function startBirthdayMail() {
  if (started) return;
  started = true;
  setInterval(() => void sendBirthdayWishes(), 30 * 60 * 1000).unref?.();
  setTimeout(() => void sendBirthdayWishes(), 60_000).unref?.();
}
