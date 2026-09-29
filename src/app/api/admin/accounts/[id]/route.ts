import { db } from "@/lib/server/db";
import { PERMISSIONS } from "@/lib/cms/modules";
import { audit, canAccess, canManageRole, errorResponse, generatePassword, hashPassword, HttpError, requireAccount, toAccount } from "@/lib/server/auth";

type Ctx = { params: Promise<{ id: string }> };

async function load(ctx: Ctx) {
  const { id } = await ctx.params;
  const actor = await requireAccount((a) => a.role === "admin" || canAccess(a, "accounts"));
  const sql = await db();
  const rows = await sql`select * from vgmf.accounts where id = ${id}`;
  if (!rows[0]) throw new HttpError(404, "Account not found.");
  const target = toAccount(rows[0] as never);
  if (!canManageRole(actor, target.role)) throw new HttpError(403, "You cannot manage this account.");
  return { actor, target, sql };
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { actor, target, sql } = await load(ctx);
    const body = (await request.json()) as {
      firstName?: string; lastName?: string; phone?: string; notes?: string;
      permissions?: string[]; active?: boolean; resetPassword?: boolean; password?: string;
    };
    if (target.id === actor.id && body.active === false) throw new HttpError(400, "You cannot deactivate your own account.");
    const valid = new Set(PERMISSIONS.map((p) => p.key));
    const permissions = body.permissions ? body.permissions.filter((p) => valid.has(p)) : target.permissions;
    let password: string | undefined;
    if (body.resetPassword || body.password) {
      password = body.password?.trim() || generatePassword();
      if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
    }
    const rows = await sql`
      update vgmf.accounts set
        first_name = ${body.firstName?.trim() || target.firstName},
        last_name = ${body.lastName ?? target.lastName},
        phone = ${body.phone ?? target.phone},
        notes = ${body.notes ?? target.notes},
        permissions = ${target.role === "staff" ? permissions : []},
        active = ${body.active ?? target.active}
        ${password ? sql`, password_hash = ${hashPassword(password)}` : sql``}
      where id = ${target.id} returning *`;
    await audit(actor.email, password ? "reset password" : "updated account", target.email);
    return Response.json({ account: toAccount(rows[0] as never), password });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { actor, target, sql } = await load(ctx);
    if (target.id === actor.id) throw new HttpError(400, "You cannot delete your own account.");
    await sql`delete from vgmf.accounts where id = ${target.id}`;
    await audit(actor.email, "deleted account", target.email);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
