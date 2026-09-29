import { db } from "@/lib/server/db";
import { audit, errorResponse, hashPassword, requireAccount, verifyPassword } from "@/lib/server/auth";

export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const body = (await request.json()) as { current?: string; next?: string };
    if (!body.next || body.next.length < 8) {
      return Response.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
    const sql = await db();
    const rows = await sql<{ password_hash: string }[]>`select password_hash from vgmf.accounts where id = ${account.id}`;
    if (!rows[0] || !verifyPassword(body.current ?? "", rows[0].password_hash)) {
      return Response.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    await sql`update vgmf.accounts set password_hash = ${hashPassword(body.next)} where id = ${account.id}`;
    await audit(account.email, "changed password");
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
