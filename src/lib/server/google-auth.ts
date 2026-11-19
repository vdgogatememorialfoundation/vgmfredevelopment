import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";

export type GoogleIdentity = { email: string; firstName: string; lastName: string };

const tickets = new Map<string, GoogleIdentity & { expires: number }>();

export function googleClient() {
  return { id: process.env.GOOGLE_CLIENT_ID || "", secret: process.env.GOOGLE_CLIENT_SECRET || "" };
}

export function siteOrigin(request: NextRequest) {
  const configured = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  return (configured || request.nextUrl.origin).replace(/\/$/, "");
}

export function googleRedirectUri(request: NextRequest) {
  return `${siteOrigin(request)}/api/auth/google/callback`;
}

export function safeNext(value: string | null | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "";
}

export function issueGoogleTicket(identity: GoogleIdentity) {
  const now = Date.now();
  for (const [key, value] of tickets) if (value.expires < now) tickets.delete(key);
  const ticket = randomBytes(24).toString("hex");
  tickets.set(ticket, { ...identity, expires: now + 10 * 60 * 1000 });
  return ticket;
}

export function readGoogleTicket(ticket: string): GoogleIdentity | null {
  const found = tickets.get(ticket);
  if (!found || found.expires < Date.now()) return null;
  return { email: found.email, firstName: found.firstName, lastName: found.lastName };
}

export function consumeGoogleTicket(ticket: string) {
  tickets.delete(ticket);
}
