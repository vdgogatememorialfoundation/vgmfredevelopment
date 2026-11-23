import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";
import { issueRiderLogin } from "@/lib/server/portal-accounts";
import { sendMobileEmail } from "@/lib/server/mobile-mail";
import { readLogisticsStore, writeLogisticsStore } from "@/lib/server/vgmf-logistics";

/** Admin-made sign-up links where delivery agents register and do KYC on the website. */
export type RiderOnboardingLink = {
  token: string;
  label: string;
  hubCode: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
  signups: number;
};

const FILE = dataFile("rider-onboarding-links.json");

function load(): RiderOnboardingLink[] {
  try {
    const rows = JSON.parse(readFileSync(FILE, "utf8")) as RiderOnboardingLink[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: RiderOnboardingLink[]) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

export const riderJoinUrl = (token: string) => `https://vaidyagogate.org/rider/join/${token}`;

export function listRiderLinks() {
  return load().map((l) => ({ ...l, url: riderJoinUrl(l.token) }));
}

export function createRiderLink(input: { label?: string; hubCode?: string; by: string }) {
  const rows = load();
  const link: RiderOnboardingLink = {
    token: randomBytes(9).toString("base64url"),
    label: (input.label || "").trim() || "Delivery agent sign-up",
    hubCode: (input.hubCode || "").trim().toUpperCase(),
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: input.by,
    signups: 0,
  };
  rows.unshift(link);
  save(rows);
  return { ...link, url: riderJoinUrl(link.token) };
}

export function setRiderLinkActive(token: string, active: boolean) {
  const rows = load();
  const link = rows.find((l) => l.token === token);
  if (!link) throw new Error("Link not found.");
  link.active = active;
  save(rows);
  return link;
}

export function activeRiderLink(token: string) {
  const link = load().find((l) => l.token === token.trim());
  return link?.active ? link : null;
}

export function countRiderLinkSignup(token: string) {
  const rows = load();
  const link = rows.find((l) => l.token === token);
  if (link) {
    link.signups += 1;
    save(rows);
  }
}

type LinkEnrollment = { onboardingLink?: string; riderId?: string; credentialsIssuedAt?: string };

export function markEnrollmentFromLink(email: string, token: string) {
  const store = readLogisticsStore();
  const rec = store.agentEnrollments.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  if (!rec) return;
  (rec as LinkEnrollment).onboardingLink = token;
  writeLogisticsStore(store);
}

/** After hub activation: creates the 5-digit user ID + password and emails them (link sign-ups only, once). */
export async function sendRiderLoginAfterActivation(email: string, force = false) {
  const store = readLogisticsStore();
  const rec = store.agentEnrollments.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  const extra = rec as (typeof rec & LinkEnrollment) | undefined;
  if (!rec || !extra || rec.status !== "approved") return null;
  if (!force && (!extra.onboardingLink || extra.credentialsIssuedAt)) return null;
  const login = issueRiderLogin(rec.email);
  extra.riderId = login.riderId;
  extra.credentialsIssuedAt = new Date().toISOString();
  writeLogisticsStore(store);
  const sent = await sendMobileEmail(
    login.email,
    "Your VGMF Delivery app user ID and password",
    `Namaste ${rec.name || ""},\n\nYour delivery partner account at Vaidya Gogate Memorial Foundation is now active (hub ${rec.hubCode}).\n\nUser ID: ${login.riderId}\nPassword: ${login.password}\n\nDownload the VGMF Delivery app: https://vaidyagogate.org/apps/vgmf-delivery.apk\nSign in with this user ID and password. A one-time code is emailed to you each time you sign in.\n\nDo not share your password with anyone.`
  ).catch(() => false);
  return { riderId: login.riderId, emailed: Boolean(sent) };
}
