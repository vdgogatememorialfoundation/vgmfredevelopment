import { db } from "@/lib/server/db";
import type { FieldDef, ModuleDef } from "@/lib/cms/modules";
import { runSeed } from "@/lib/server/seed";

export interface ItemRow {
  id: string;
  collection: string;
  data: Record<string, unknown>;
  status: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface Item {
  id: string;
  data: Record<string, unknown>;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    data: row.data ?? {},
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const globalSeed = globalThis as unknown as { vgmfSeed?: Promise<void> };

export function ensureSeeded(): Promise<void> {
  if (!globalSeed.vgmfSeed) {
    globalSeed.vgmfSeed = runSeed().catch((error: unknown) => {
      globalSeed.vgmfSeed = undefined;
      throw error;
    });
  }
  return globalSeed.vgmfSeed;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function coerce(field: FieldDef, raw: unknown): unknown {
  if (raw === undefined || raw === null) return undefined;
  switch (field.type) {
    case "number": {
      if (raw === "") return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case "boolean":
      return raw === true || raw === "true" || raw === "on";
    case "tags":
      if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
      return String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    case "json":
      if (typeof raw !== "string") return raw;
      if (!raw.trim()) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        throw new Error(`${field.label} must be valid JSON.`);
      }
    default:
      return String(raw).trim();
  }
}

export function cleanData(module: ModuleDef, input: Record<string, unknown>, existing: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...existing };
  for (const field of module.fields) {
    if (!(field.name in input)) continue;
    const value = coerce(field, input[field.name]);
    if (value === undefined || value === "") delete data[field.name];
    else data[field.name] = value;
  }
  for (const field of module.fields) {
    if (field.required && (data[field.name] === undefined || data[field.name] === "")) {
      throw new Error(`${field.label} is required.`);
    }
  }
  if (module.slugFrom && !data.slug && typeof data[module.slugFrom] === "string") {
    data.slug = slugify(data[module.slugFrom] as string);
  }
  if (module.filter?.field && module.filter.value && !data[module.filter.field]) {
    data[module.filter.field] = module.filter.value;
  }
  return data;
}

export async function listItems(module: ModuleDef): Promise<Item[]> {
  await ensureSeeded();
  const sql = await db();
  const { filter } = module;
  const rows = await sql<ItemRow[]>`
    select * from vgmf.items
    where collection = ${module.store}
    ${filter?.status ? sql`and status = ${filter.status}` : sql``}
    ${filter?.field && filter.value ? sql`and data->>${filter.field} = ${filter.value}` : sql``}
    order by sort_order asc, created_at desc
    limit 2000`;
  return rows.map(toItem);
}

export async function createItem(module: ModuleDef, input: { data: Record<string, unknown>; status?: string; sortOrder?: number }, actor?: string) {
  const sql = await db();
  const data = cleanData(module, input.data);
  const status = input.status && module.statuses?.includes(input.status) ? input.status : module.filter?.status ?? module.statuses?.[0] ?? "published";
  const rows = await sql<ItemRow[]>`
    insert into vgmf.items (collection, data, status, sort_order, created_by)
    values (${module.store}, ${sql.json(data as never)}, ${status}, ${input.sortOrder ?? 0}, ${actor ?? null})
    returning *`;
  return toItem(rows[0]);
}

export async function updateItem(module: ModuleDef, id: string, input: { data?: Record<string, unknown>; status?: string; sortOrder?: number }) {
  const sql = await db();
  const current = await sql<ItemRow[]>`select * from vgmf.items where id = ${id} and collection = ${module.store}`;
  if (!current[0]) throw new Error("Record not found.");
  const data = input.data ? cleanData(module, input.data, current[0].data) : current[0].data;
  const status = input.status && module.statuses?.includes(input.status) ? input.status : current[0].status;
  const sortOrder = typeof input.sortOrder === "number" ? input.sortOrder : current[0].sort_order;
  const rows = await sql<ItemRow[]>`
    update vgmf.items set data = ${sql.json(data as never)}, status = ${status}, sort_order = ${sortOrder}, updated_at = now()
    where id = ${id} returning *`;
  return toItem(rows[0]);
}

export async function deleteItem(module: ModuleDef, id: string) {
  const sql = await db();
  await sql`delete from vgmf.items where id = ${id} and collection = ${module.store}`;
}

export async function getSetting<T extends Record<string, unknown>>(key: string): Promise<T | null> {
  await ensureSeeded();
  const sql = await db();
  const rows = await sql<{ value: T }[]>`select value from vgmf.settings where key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function putSetting(key: string, value: Record<string, unknown>) {
  const sql = await db();
  await sql`
    insert into vgmf.settings (key, value, updated_at) values (${key}, ${sql.json(value as never)}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}
