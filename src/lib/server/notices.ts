import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { notices as seededNotices } from "@/data/content";
import { isPublishedNow } from "@/lib/schedule";
import { dataFile } from "@/lib/server/paths";
import type { Notice } from "@/types";

export type StoredNotice = Notice & { updatedAt: string };

const LEGACY_FILE = join("/tmp", "vgmf-notices.json");

function filePath() {
  return dataFile("notices.json");
}

function seed(): StoredNotice[] {
  return seededNotices.map((notice) => ({ ...notice, updatedAt: `${notice.date}T00:00:00.000Z` }));
}

function read(): StoredNotice[] {
  for (const file of [filePath(), LEGACY_FILE]) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as StoredNotice[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      /* try the next path */
    }
  }
  const next = seed();
  write(next);
  return next;
}

function write(notices: StoredNotice[]) {
  try {
    const file = filePath();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(notices));
  } catch {
    /* ephemeral host */
  }
}

export function listNotices(opts?: { includeScheduled?: boolean }) {
  const notices = read().sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt);
  });
  return opts?.includeScheduled ? notices : notices.filter((notice) => isPublishedNow(notice));
}

export function queryNotices(query: { q?: string; category?: string; kind?: string; year?: string; includeScheduled?: boolean }) {
  const q = query.q?.trim().toLowerCase() ?? "";
  return listNotices({ includeScheduled: query.includeScheduled }).filter((notice) => {
    if (query.category && notice.category !== query.category) return false;
    if (query.year && notice.date.slice(0, 4) !== query.year) return false;
    if (query.kind === "file" && !notice.attachment) return false;
    if (query.kind === "text" && notice.attachment) return false;
    if (query.kind === "pinned" && !notice.pinned) return false;
    if (!q) return true;
    return [notice.title, notice.description, notice.category, notice.fileName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });
}

export function getNotice(id: string) {
  return read().find((notice) => notice.id === id) ?? null;
}

export function upsertNotice(input: Partial<Notice> & Pick<Notice, "title">) {
  const notices = read();
  const id = input.id?.trim() || `ntc-${Date.now()}`;
  const existing = notices.find((notice) => notice.id === id);
  const next: StoredNotice = {
    id,
    title: input.title.trim(),
    date: input.date?.trim() || existing?.date || new Date().toISOString().slice(0, 10),
    category: input.category?.trim() || existing?.category || "Notice",
    description: (input.description ?? existing?.description ?? "").trim(),
    attachment: input.attachment === undefined ? existing?.attachment : input.attachment,
    fileName: input.fileName === undefined ? existing?.fileName : input.fileName,
    fileType: input.fileType === undefined ? existing?.fileType : input.fileType,
    pinned: input.pinned ?? existing?.pinned ?? false,
    href: input.href?.trim() || existing?.href || `/#notices`,
    publishAt: input.publishAt === undefined ? existing?.publishAt : input.publishAt || undefined,
    unpublishAt: input.unpublishAt === undefined ? existing?.unpublishAt : input.unpublishAt || undefined,
    updatedAt: new Date().toISOString(),
  };
  if (!next.title) throw new Error("Add a title.");
  if (!next.description && !next.attachment) {
    throw new Error("Add notice text, a file, or both.");
  }
  const others = notices.filter((notice) => notice.id !== id);
  write([next, ...others]);
  return next;
}

export async function fileFromForm(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return {};
  try {
    const { storeUploadedFile } = await import("@/lib/server/media-upload");
    const stored = await storeUploadedFile(file);
    return { attachment: stored.url, fileName: stored.name, fileType: stored.type };
  } catch {
    if (file.size > 2_000_000) throw new Error("Use a file under 2 MB, or connect media storage.");
    const buffer = Buffer.from(await file.arrayBuffer());
    return {
      attachment: `data:${file.type || "application/octet-stream"};base64,${buffer.toString("base64")}`,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
    };
  }
}

export function asBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "1" || value === "on";
}

export function scheduleFromForm(form: FormData) {
  return {
    publishAt: form.has("publishAt") ? String(form.get("publishAt") ?? "") : undefined,
    unpublishAt: form.has("unpublishAt") ? String(form.get("unpublishAt") ?? "") : undefined,
  };
}

export function removeNotice(id: string) {
  const notices = read();
  const next = notices.filter((notice) => notice.id !== id);
  if (next.length === notices.length) return false;
  write(next);
  return true;
}

export function publicNotice(notice: StoredNotice) {
  const { attachment, ...rest } = notice;
  return {
    ...rest,
    hasFile: Boolean(attachment),
    fileUrl: attachment ? `/api/notices/${notice.id}/file` : undefined,
  };
}
