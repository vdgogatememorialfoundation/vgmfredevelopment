import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";

export type MediaConfig = {
  cloudflare: { accountId: string; apiToken: string; accountHash: string };
  googleDrive: { folderId: string; clientEmail: string; privateKey: string };
};

const EMPTY: MediaConfig = {
  cloudflare: { accountId: "", apiToken: "", accountHash: "" },
  googleDrive: { folderId: "", clientEmail: "", privateKey: "" },
};

function filePath() {
  return dataFile("media-config.json");
}

export function readMediaConfig(): MediaConfig {
  try {
    const parsed = JSON.parse(readFileSync(/* turbopackIgnore: true */ filePath(), "utf8")) as MediaConfig;
    return {
      cloudflare: { ...EMPTY.cloudflare, ...parsed.cloudflare },
      googleDrive: { ...EMPTY.googleDrive, ...parsed.googleDrive },
    };
  } catch {
    return {
      cloudflare: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
        apiToken: process.env.CLOUDFLARE_API_TOKEN || "",
        accountHash: process.env.CLOUDFLARE_IMAGES_HASH || "",
      },
      googleDrive: {
        folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "",
        clientEmail: process.env.GOOGLE_DRIVE_CLIENT_EMAIL || "",
        privateKey: (process.env.GOOGLE_DRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      },
    };
  }
}

export function writeMediaConfig(next: MediaConfig) {
  const file = filePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(next));
  return publicMediaStatus(next);
}

export function publicMediaStatus(config = readMediaConfig()) {
  return {
    cloudflare: {
      configured: Boolean(config.cloudflare.accountId && config.cloudflare.apiToken),
    },
    googleDrive: {
      configured: Boolean(config.googleDrive.folderId && config.googleDrive.clientEmail && config.googleDrive.privateKey),
    },
  };
}

function mergeSecret(current: string, incoming?: string) {
  if (incoming === undefined) return current;
  if (!incoming.trim() || incoming.includes("…") || incoming.includes("•")) return current;
  return incoming.trim();
}

export function patchMediaConfig(body: Record<string, unknown>) {
  const current = readMediaConfig();
  const cloudflare = (body.cloudflare ?? {}) as Record<string, string>;
  const googleDrive = (body.googleDrive ?? {}) as Record<string, string>;
  const next: MediaConfig = {
    cloudflare: {
      accountId: mergeSecret(current.cloudflare.accountId, cloudflare.accountId),
      apiToken: mergeSecret(current.cloudflare.apiToken, cloudflare.apiToken),
      accountHash: mergeSecret(current.cloudflare.accountHash, cloudflare.accountHash),
    },
    googleDrive: {
      folderId: mergeSecret(current.googleDrive.folderId, googleDrive.folderId),
      clientEmail: mergeSecret(current.googleDrive.clientEmail, googleDrive.clientEmail),
      privateKey: mergeSecret(current.googleDrive.privateKey, googleDrive.privateKey),
    },
  };
  return writeMediaConfig(next);
}
