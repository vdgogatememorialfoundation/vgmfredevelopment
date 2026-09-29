import { db } from "@/lib/server/db";
import { canAccess, errorResponse, requireAccount } from "@/lib/server/auth";
import { ensureSeeded } from "@/lib/server/cms";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const account = await requireAccount((a) => a.role === "admin" || a.role === "staff");
    await ensureSeeded();
    const sql = await db();
    const counts = await sql<{ collection: string; status: string; n: number }[]>`
      select collection, status, count(*)::int as n from vgmf.items group by collection, status`;
    const visible = counts.filter((c) => account.role === "admin" || canAccess(account, c.collection));
    const revenue = await sql<{ total: number }[]>`
      select coalesce(sum((data->>'amount')::numeric), 0)::float as total from vgmf.items
      where collection = 'payments' and status = 'Success'`;
    const donations = await sql<{ total: number }[]>`
      select coalesce(sum((data->>'amount')::numeric), 0)::float as total from vgmf.items where collection = 'donations' and status <> 'Cancelled'`;
    const orders = await sql<{ total: number }[]>`
      select coalesce(sum((data->>'total')::numeric), 0)::float as total from vgmf.items where collection = 'orders' and status <> 'Cancelled'`;
    const roles = account.role === "admin"
      ? await sql<{ role: string; n: number }[]>`select role, count(*)::int as n from vgmf.accounts group by role`
      : [];
    const activity = account.role === "admin"
      ? await sql`select actor, action, target, at from vgmf.audit order by at desc limit 12`
      : [];
    return Response.json({
      counts: visible,
      totals: {
        payments: account.role === "admin" || canAccess(account, "payments") ? revenue[0]?.total ?? 0 : null,
        donations: account.role === "admin" || canAccess(account, "donations") ? donations[0]?.total ?? 0 : null,
        orders: account.role === "admin" || canAccess(account, "orders") ? orders[0]?.total ?? 0 : null,
      },
      roles,
      activity,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
