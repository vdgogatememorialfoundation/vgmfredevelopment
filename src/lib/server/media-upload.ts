import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, extname } from "node:path";
import { randomBytes } from "node:crypto";
import { dataFile } from "@/lib/server/paths";
import { putR2Object, r2Settings } from "@/lib/server/r2";

export type StoredFile = { url: string; name: string; type: string; provider: "local" | "r2" };

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "application/octet-stream",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
};

function extensionFor(file: File) {
  const fromName = extname(file.name).toLowerCase();
  if (fromName && /^[.\w]+$/.test(fromName)) return fromName;
  const fromType = Object.entries(TYPES).find(([, type]) => type === file.type)?.[0];
  return fromType || "";
}

function storedFileName(file: File) {
  const ext = extensionFor(file);
  const base = file.name
    .replace(extname(file.name), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "file";
  return `${base}-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
}

function publicUploadUrl(name: string) {
  return `/uploads/${name}`;
}

function storedType(file: File) {
  const type = file.type || TYPES[extensionFor(file)] || "application/octet-stream";
  return type.includes("svg") ? "application/octet-stream" : type;
}

async function saveLocal(file: File, name: string, bytes: Buffer) {
  const dest = dataFile("uploads", name);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, bytes);
  return { url: publicUploadUrl(name), name: file.name, type: storedType(file), provider: "local" as const };
}

async function uploadR2(name: string, bytes: Buffer, type: string) {
  if (!r2Settings().configured) return false;
  await putR2Object(`uploads/${name}`, bytes, type || "application/octet-stream");
  return true;
}

export async function storeUploadedFile(file: File): Promise<StoredFile> {
  if (file.size > 25_000_000) throw new Error("Use a file under 25 MB.");
  const name = storedFileName(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  const local = await saveLocal(file, name, bytes);
  const remote = await uploadR2(name, bytes, local.type).catch(() => false);
  return remote ? { ...local, provider: "r2" } : local;
}
