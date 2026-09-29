import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "vgmf_portal";
export const SESSION_HOURS = 12;

export interface SessionPayload {
  sub: string;
  role: string;
  exp: number;
}

function secret() {
  const value = process.env.AUTH_SECRET || process.env.DATABASE_URL;
  if (!value) throw new Error("AUTH_SECRET or DATABASE_URL must be configured");
  return createHash("sha256").update(`vgmf-portal:${value}`).digest();
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(id: string, role: string) {
  const payload = Buffer.from(
    JSON.stringify({ sub: id, role, exp: Date.now() + SESSION_HOURS * 3600_000 } satisfies SessionPayload)
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !(process.env.AUTH_SECRET || process.env.DATABASE_URL)) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}
