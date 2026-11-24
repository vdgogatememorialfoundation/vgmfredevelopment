import { createHash, createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { checkPortalLogin } from "@/lib/server/portal-accounts";
import { readLogisticsStore } from "@/lib/server/vgmf-logistics";

const COOKIE_NAME = "vgmf-hub-session";
const SECRET = process.env.VGMF_HUB_SECRET || process.env.SESSION_SECRET || "vgmf-hub-portal-secret-2026";

function signToken(payload: Record<string, unknown>) {
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyToken(token?: string) {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  const expected = createHmac("sha256", SECRET).update(data).digest("base64url");
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as {
      hubCode: string;
      hubName: string;
      email: string;
      name: string;
      role: string;
    };
  } catch {
    return null;
  }
}

export function hashHubPin(raw: string) {
  return createHash("sha256").update(`vgmf-hub:${raw.trim()}`).digest("hex");
}

export async function GET(req: NextRequest) {
  const store = readLogisticsStore();
  const session = verifyToken(req.cookies.get(COOKIE_NAME)?.value);
  return NextResponse.json({
    ok: true,
    session,
    hubs: store.hubs.map((h) => ({ code: h.code, name: h.name, type: h.type, city: h.city })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body?.action || "login");

    if (action === "logout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
      return res;
    }

    const hubCode = String(body?.hubCode || "").trim().toUpperCase();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "").trim();
    if (!hubCode || !email || !password) {
      return NextResponse.json({ ok: false, error: "Select a hub and enter your Hub Staff email and password/PIN." }, { status: 400 });
    }

    const store = readLogisticsStore();
    const hub = store.hubs.find((h) => h.code.toUpperCase() === hubCode);
    if (!hub) {
      return NextResponse.json({ ok: false, error: "Selected hub was not found." }, { status: 404 });
    }

    // 1. Check dedicated Hub Executive account configured under this hub
    const exec = hub.executives.find((e) => e.email.toLowerCase() === email);
    let authedUser: { name: string; role: string } | null = null;

    if (exec) {
      const storedHash = String((exec as unknown as { passwordHash?: string }).passwordHash || "");
      if (storedHash && (storedHash === hashHubPin(password) || storedHash === password)) {
        authedUser = { name: exec.name, role: exec.role };
      }
    }

    // 2. Fallback: allow VGMF Admin / Hub Manager portal login credentials
    if (!authedUser) {
      const acct = checkPortalLogin(email, password);
      if (acct) {
        if (acct.role === "admin" || acct.role === "coadmin" || exec) {
          authedUser = {
            name: `${acct.firstName || ""} ${acct.lastName || ""}`.trim() || acct.email,
            role: exec?.role || "hub_manager",
          };
        }
      }
    }

    if (!authedUser) {
      return NextResponse.json(
        { ok: false, error: "Invalid Hub Staff credentials or not assigned to this hub. Contact VGMF Logistics Admin." },
        { status: 401 }
      );
    }

    const session = {
      hubCode: hub.code,
      hubName: hub.name,
      email,
      name: authedUser.name,
      role: authedUser.role,
    };
    const token = signToken(session);
    const res = NextResponse.json({ ok: true, session });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Login failed." }, { status: 400 });
  }
}
