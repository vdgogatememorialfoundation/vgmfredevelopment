import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dataFile, ensureDataDir } from "@/lib/server/paths";

export type EmailLogEntry = { id?: string; at: string; to: string; subject: string; ok: boolean; provider?: string; error?: string; refs: string[] };

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

/** Order ids (12 digits, split orders with -1/-2) in the subject and text, so each order can list the emails about it. */
function refsIn(subject: string, html: string) {
  const text = `${subject} ${html.replace(/<[^>]+>/g, " ")}`;
  return [...new Set(text.match(/(?<!\d)\d{12}(?:-\d{1,2})?(?![\d-])/g) ?? [])].slice(0, 20);
}

export function logEmail(mail: { to: string; subject: string; html: string }, result: { ok: boolean; provider?: string; error?: string }) {
  try {
    const id = randomUUID();
    const entry: EmailLogEntry = {
      id,
      at: new Date().toISOString(),
      to: mail.to,
      subject: mail.subject.slice(0, 300),
      ok: result.ok,
      ...(result.provider ? { provider: result.provider } : {}),
      ...(result.error ? { error: result.error.slice(0, 300) } : {}),
      refs: refsIn(mail.subject, mail.html),
    };
    try {
      ensureDataDir("email-bodies");
      writeFileSync(dataFile("email-bodies", `${id}.html`), mail.html.slice(0, 500_000));
    } catch {
      /* body only needed for resend */
    }
    const target = file();
    const temp = `${target}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify([entry, ...readLog()].slice(0, LIMIT)));
    renameSync(temp, target);
  } catch {
    /* read-only host */
  }
}

/** Newest emails first, optionally filtered by recipient / subject / order id text. */
export function recentEmails(query = "", limit = 300) {
  const q = query.trim().toLowerCase();
  const all = readLog();
  return (q ? all.filter((entry) => `${entry.to} ${entry.subject} ${(entry.refs ?? []).join(" ")}`.toLowerCase().includes(q)) : all).slice(0, limit);
}

/** The logged email and its saved HTML body, for an exact resend. */
export function loggedEmail(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const entry = readLog().find((item) => item.id === id);
  if (!entry) return null;
  try {
    return { entry, html: readFileSync(dataFile("email-bodies", `${id}.html`), "utf8") };
  } catch {
    return null;
  }
}

export function emailsForOrder(orderId: string) {
  return readLog().filter((entry) => entry.refs?.includes(orderId));
}
