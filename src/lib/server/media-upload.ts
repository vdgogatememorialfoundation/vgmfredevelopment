import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, extname } from "node:path";
import { createSign } from "node:crypto";
import { readMediaConfig } from "@/lib/server/media-config";
import { dataFile } from "@/lib/server/paths";
import { putR2Object, r2Settings } from "@/lib/server/r2";

export type StoredFile = { url: string; name: string; type: string; provider: "local" | "r2" | "cloudflare" | "drive" };

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
};

function isImage(type: string) {
  return type.startsWith("image/") && type !== "image/svg+xml";
}

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
  return `${base}-${Date.now()}${ext}`;
}

function publicUploadUrl(name: string) {
  return `/uploads/${name}`;
}

async function saveLocal(file: File, name: string, bytes: Buffer) {
  const dest = dataFile("uploads", name);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, bytes);
  return { url: publicUploadUrl(name), name: file.name, type: file.type || TYPES[extensionFor(file)] || "application/octet-stream", provider: "local" as const };
}

async function uploadR2(name: string, bytes: Buffer, type: string) {
  if (!r2Settings().configured) return false;
  await putR2Object(`uploads/${name}`, bytes, type || "application/octet-stream");
  return true;
}

async function uploadCloudflare(file: File): Promise<StoredFile | null> {
  const config = readMediaConfig().cloudflare;
  if (!config.accountId || !config.apiToken) return null;
  const body = new FormData();
  body.set("file", file, file.name);
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/images/v1`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.apiToken}` },
    body,
  });
  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    result?: { id?: string; variants?: string[] };
  };
  if (!response.ok || !data.success) return null;
  const url =
    data.result?.variants?.[0] ||
    (config.accountHash && data.result?.id ? `https://imagedelivery.net/${config.accountHash}/${data.result.id}/public` : "");
  if (!url) return null;
  return { url, name: file.name, type: file.type, provider: "cloudflare" };
}

function driveJwt(email: string, key: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/drive.file",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(key.replace(/\\n/g, "\n"), "base64url");
  return `${header}.${payload}.${signature}`;
}

async function driveToken() {
  const config = readMediaConfig().googleDrive;
  if (!config.clientEmail || !config.privateKey) return "";
  const assertion = driveJwt(config.clientEmail, config.privateKey);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as { access_token?: string };
  return data.access_token || "";
}

async function uploadDrive(file: File): Promise<StoredFile | null> {
  const config = readMediaConfig().googleDrive;
  const token = await driveToken();
  if (!token || !config.folderId) return null;
  const metadata = {
    name: file.name,
    parents: [config.folderId],
  };
  const body = new FormData();
  body.set("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  body.set("file", file, file.name);
  const uploaded = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body,
  });
  const data = (await uploaded.json().catch(() => ({}))) as { id?: string };
  if (!uploaded.ok || !data.id) return null;
  await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  return {
    url: `https://drive.google.com/uc?export=view&id=${data.id}`,
    name: file.name,
    type: file.type,
    provider: "drive",
  };
}

export async function storeUploadedFile(file: File): Promise<StoredFile> {
  if (file.size > 25_000_000) throw new Error("Use a file under 25 MB.");
  const name = storedFileName(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  const local = await saveLocal(file, name, bytes);
  const remote = await uploadR2(name, bytes, local.type)
    .then((ok) => ok)
    .catch(() => false);
  if (remote) return { ...local, provider: "r2" };
  if (isImage(file.type)) {
    const cloud = await uploadCloudflare(file).catch(() => null);
    if (cloud) return local;
  }
  const drive = await uploadDrive(file).catch(() => null);
  if (drive) return local;
  return local;
}
