import { createSign } from "node:crypto";
import { readMediaConfig } from "@/lib/server/media-config";

export type StoredFile = { url: string; name: string; type: string; provider: "cloudflare" | "drive" };

function isImage(type: string) {
  return type.startsWith("image/") && type !== "image/svg+xml";
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
  if (isImage(file.type)) {
    const cloud = await uploadCloudflare(file).catch(() => null);
    if (cloud) return cloud;
  }
  const drive = await uploadDrive(file).catch(() => null);
  if (drive) return drive;
  if (isImage(file.type) === false) {
    const cloud = await uploadCloudflare(file).catch(() => null);
    if (cloud) return cloud;
  }
  throw new Error("Add Cloudflare Images or Google Drive in Admin → Settings → Media storage, then try again.");
}
