import { db } from "@/lib/server/db";
import { ACCOUNT_ROLES, PERMISSIONS, type AccountRole } from "@/lib/cms/modules";
import { audit, canAccess, canManageRole, errorResponse, generatePassword, hashPassword, HttpError, nextAccountId, requireAccount, toAccount } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireAccount((a) => a.role === "admin" || canAccess(a, "accounts"));
    const sql = await db();
    const rows = await sql`select * from vgmf.accounts order by created_at desc`;
    const accounts = rows.map((r) => toAccount(r as never)).filter((a) => canManageRole(actor, a.role));
    return Response.json({ accounts });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAccount((a) => a.role === "admin" || canAccess(a, "accounts"));
    const body = (await request.json()) as {
      firstName?: string; lastName?: string; email?: string; phone?: string;
      role?: AccountRole; permissions?: string[]; password?: string; notes?: string;
    };
    const role = body.role ?? "customer";
    if (!ACCOUNT_ROLES.includes(role)) throw new HttpError(400, "Invalid role.");
    if (!canManageRole(actor, role)) throw new HttpError(403, "Only administrators can create admin or staff accounts.");
    const email = (body.email ?? "").trim().toLowerCase();
    if (!body.firstName?.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new HttpError(400, "First name and a valid email are required.");
    }
    const password = body.password?.trim() || generatePassword();
    if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
    const valid = new Set(PERMISSIONS.map((p) => p.key));
    const permissions = role === "staff" ? (body.permissions ?? []).filter((p) => valid.has(p)) : [];
    const sql = await db();
    const exists = await sql`select 1 from vgmf.accounts where lower(email) = ${email}`;
    if (exists.length) throw new HttpError(409, "An account with this email already exists.");
    const accountId = await nextAccountId(role);
    const rows = await sql`
      insert into vgmf.accounts (account_id, first_name, last_name, email, phone, role, permissions, password_hash, notes, created_by)
      values (${accountId}, ${body.firstName.trim()}, ${(body.lastName ?? "").trim()}, ${email}, ${(body.phone ?? "").trim()},
              ${role}, ${permissions}, ${hashPassword(password)}, ${(body.notes ?? "").trim()}, ${actor.id})
      returning *`;
    await audit(actor.email, `created ${role} account`, email);
    return Response.json({ account: toAccount(rows[0] as never), password });
  } catch (error) {
    return errorResponse(error);
  }
}
