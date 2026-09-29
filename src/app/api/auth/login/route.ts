import { cookies } from "next/headers";
import { db, isDbConfigured } from "@/lib/server/db";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions, toAccount, verifyPassword, audit } from "@/lib/server/auth";
import type { AccountRole } from "@/lib/cms/modules";

const PORTAL_ROLES: Record<string, AccountRole[]> = {
  admin: ["admin"],
  staff: ["staff"],
  seller: ["seller"],
  delivery: ["delivery"],
  customer: ["customer", "admin", "staff", "seller", "delivery"],
};

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return Response.json({ error: "The portal database is not configured yet (DATABASE_URL)." }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { identifier?: string; password?: string; portal?: string };
  const identifier = (body.identifier ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const roles = PORTAL_ROLES[body.portal ?? "customer"];
  if (!identifier || !password || !roles) {
    return Response.json({ error: "Enter your email / Account ID and password." }, { status: 400 });
  }
  const sql = await db();
  const digits = identifier.replace(/\D/g, "");
  const rows = await sql`
    select * from vgmf.accounts
    where lower(email) = ${identifier} or lower(account_id) = ${identifier}
      ${digits.length >= 10 ? sql`or regexp_replace(phone, '\\D', '', 'g') like ${"%" + digits.slice(-10)}` : sql``}
    limit 1`;
  const row = rows[0];
  if (!row || !verifyPassword(password, row.password_hash as string)) {
    return Response.json({ error: "Incorrect login details." }, { status: 401 });
  }
  if (!row.active) {
    return Response.json({ error: "This account has been deactivated. Contact the administrator." }, { status: 403 });
  }
  if (!roles.includes(row.role as AccountRole)) {
    return Response.json({ error: `This account cannot sign in to the ${body.portal} portal.` }, { status: 403 });
  }
  await sql`update vgmf.accounts set last_login_at = now() where id = ${row.id as string}`;
  const account = toAccount(row as never);
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(account.id, account.role), sessionCookieOptions);
  await audit(account.email, "signed in", body.portal ?? "");
  return Response.json({ account });
}
