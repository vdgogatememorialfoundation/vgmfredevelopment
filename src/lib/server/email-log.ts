import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dataFile } from "@/lib/server/paths";

export type EmailLogEntry = { at: string; to: string; subject: string; ok: boolean; provider?: string; error?: string; refs: string[] };

const LIMIT = 20000;

function file() {
  return dataFile("email-log.json");
}

function readLog(): EmailLogEntry[] {
  try {
    const parsed = JSON.parse(readFileSync(file(), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Order ids (12 digits) in the subject and text, so each order can list the emails about it. */
function refsIn(subject: string, html: string) {
  const text = `${subject} ${html.replace(/<[^>]+>/g, " ")}`;
  return [...new Set(text.match(/(?<!\d)\d{12}(?!\d)/g) ?? [])].slice(0, 20);
}

export function logEmail(mail: { to: string; subject: string; html: string }, result: { ok: boolean; provider?: string; error?: string }) {
  try {
    const entry: EmailLogEntry = {
      at: new Date().toISOString(),
      to: mail.to,
      subject: mail.subject.slice(0, 300),
      ok: result.ok,
      ...(result.provider ? { provider: result.provider } : {}),
      ...(result.error ? { error: result.error.slice(0, 300) } : {}),
      refs: refsIn(mail.subject, mail.html),
    };
    const target = file();
    const temp = `${target}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify([entry, ...readLog()].slice(0, LIMIT)));
    renameSync(temp, target);
  } catch {
    /* read-only host */
  }
}

export function emailsForOrder(orderId: string) {
  return readLog().filter((entry) => entry.refs?.includes(orderId));
}
