import { db, isDbConfigured } from "@/lib/server/db";
import { ensureSeeded } from "@/lib/server/cms";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = (url.searchParams.get("id") ?? "").trim();
  if (!isDbConfigured() || !id) return Response.json({ result: null, configured: isDbConfigured() });
  await ensureSeeded();
  const sql = await db();
  if (type === "certificate") {
    const rows = await sql`select data from vgmf.items where collection = 'certificates' and status = 'valid'
      and upper(data->>'certificateNumber') = ${id.toUpperCase()} limit 1`;
    return Response.json({ result: rows[0]?.data ?? null, configured: true });
  }
  if (type === "application") {
    const rows = await sql`select data, status, created_at from vgmf.items where collection = 'applications'
      and upper(data->>'applicationId') = ${id.toUpperCase()} limit 1`;
    const row = rows[0];
    return Response.json({
      result: row ? { ...(row.data as object), status: row.status, appliedAt: (row.data as { appliedAt?: string }).appliedAt ?? new Date(row.created_at as Date).toISOString() } : null,
      configured: true,
    });
  }
  return Response.json({ error: "Unknown lookup." }, { status: 400 });
}
