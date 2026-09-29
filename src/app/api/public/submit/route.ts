import { randomBytes } from "node:crypto";
import { getModule } from "@/lib/cms/modules";
import { isDbConfigured } from "@/lib/server/db";
import { createItem, ensureSeeded } from "@/lib/server/cms";

const ID_FIELDS: Record<string, { field: string; prefix: string }> = {
  "event-registrations": { field: "registrationId", prefix: "REG" },
  "support-tickets": { field: "ticketNumber", prefix: "TKT" },
};

export async function POST(request: Request) {
  if (!isDbConfigured()) return Response.json({ stored: false }, { status: 202 });
  const text = await request.text();
  if (text.length > 30_000) return Response.json({ error: "Submission too large." }, { status: 413 });
  let body: { kind?: string; data?: Record<string, unknown>; website?: string };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (body.website) return Response.json({ stored: true });
  const mod = body.kind ? getModule(body.kind) : undefined;
  if (!mod || !mod.publicSubmissions) {
    return Response.json({ error: "Unknown form." }, { status: 400 });
  }
  const data = { ...(body.data ?? {}) };
  const idField = ID_FIELDS[mod.key];
  if (idField && !data[idField.field]) {
    data[idField.field] = `${idField.prefix}-${randomBytes(3).toString("hex").toUpperCase()}`;
  }
  try {
    await ensureSeeded();
    const item = await createItem(mod, { data });
    return Response.json({ stored: true, reference: idField ? item.data[idField.field] : item.id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save." }, { status: 400 });
  }
}
