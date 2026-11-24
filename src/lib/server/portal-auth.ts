import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { dataFile } from "@/lib/server/paths";

const PORTAL_COOKIE = "vgmf_admin_session";
const PORTAL_ROLES = new Set(["admin", "coadmin", "staff", "doctor"]);

export type PortalSessionUser = {
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  staffRoleId?: string;
};

type StoredPortalSession = PortalSessionUser & {
  token: string;
  createdAt: string;
};

let cachedSessions: StoredPortalSession[] | null = null;

function sessionsPath() {
  return dataFile("mobile-portal-sessions.json");
}

function loadPortalSessions(): StoredPortalSession[] {
  if (cachedSessions) return cachedSessions;
  try {
    const raw = JSON.parse(readFileSync(sessionsPath(), "utf8"));
    cachedSessions = Array.isArray(raw) ? (raw as StoredPortalSession[]) : [];
  } catch {
    cachedSessions = [];
  }
  return cachedSessions;
}

function savePortalSessions(list: StoredPortalSession[]) {
  cachedSessions = list;
  try {
    mkdirSync(dirname(sessionsPath()), { recursive: true });
    writeFileSync(sessionsPath(), JSON.stringify(list));
  } catch {
    /* ignore write failures on read-only fs */
  }
}

export function createPortalMobileSession(user: PortalSessionUser): StoredPortalSession {
  const session: StoredPortalSession = {
    token: randomBytes(28).toString("hex"),
    email: String(user.email || "").trim().toLowerCase(),
    role: String(user.role || "staff"),
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name || [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email,
    staffRoleId: user.staffRoleId,
    createdAt: new Date().toISOString(),
  };
  const next = [...loadPortalSessions().slice(-199), session];
  savePortalSessions(next);
  return session;
}

export function portalSessionFromToken(token?: string | null): PortalSessionUser | null {
  const clean = String(token || "").trim();
  if (!clean) return null;
  const match = loadPortalSessions().find((item) => item.token === clean);
  if (!match || !PORTAL_ROLES.has(match.role)) return null;
  return {
    email: match.email,
    role: match.role,
    firstName: match.firstName,
    lastName: match.lastName,
    name: match.name,
    staffRoleId: match.staffRoleId,
  };
}


export function revokeAllPortalSessionsForEmail(email: string) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean) return;
  savePortalSessions(loadPortalSessions().filter((item) => item.email.toLowerCase() !== clean));
}

export function revokePortalMobileSession(token?: string | null) {
  const clean = String(token || "").trim();
  if (!clean) return;
  savePortalSessions(loadPortalSessions().filter((item) => item.token !== clean));
}

export function extractBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function parseSession(raw: string | undefined): PortalSessionUser | null {
  if (!raw) return null;
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    /* already decoded */
  }
  for (const value of candidates) {
    try {
      const parsed = JSON.parse(value) as PortalSessionUser;
      if (parsed?.email && PORTAL_ROLES.has(parsed.role || "")) return parsed;
    } catch {
      /* try the next encoding */
    }
  }
  return null;
}

export function portalSessionFrom(request: NextRequest): PortalSessionUser | null {
  const fromCookie = parseSession(request.cookies.get(PORTAL_COOKIE)?.value);
  if (fromCookie) return fromCookie;
  return portalSessionFromToken(extractBearerToken(request));
}

export function denyUnlessPortal(request: NextRequest) {
  if (portalSessionFrom(request)) return null;
  return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
}
