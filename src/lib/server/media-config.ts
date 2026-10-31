import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";

export type MediaConfig = {
  cloudflare: { accountId: string; apiToken: string; accountHash: string };
  googleDrive: { folderId: string; clientEmail: string; privateKey: string };
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    endpoint: string;
    region: string;
  };
};

const EMPTY: MediaConfig = {
  cloudflare: { accountId: "", apiToken: "", accountHash: "" },
  googleDrive: { folderId: "", clientEmail: "", privateKey: "" },
  r2: { accountId: "", accessKeyId: "", secretAccessKey: "", bucket: "", endpoint: "", region: "auto" },
};

function filePath() {
  return dataFile("media-config.json");
}

function fromEnv(): MediaConfig {
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
    r2: {
      accountId: process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "",
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      bucket: process.env.R2_BUCKET || "vgmf-staging-main",
      endpoint: process.env.R2_ENDPOINT || "",
      region: process.env.R2_REGION || "auto",
    },
  };
}

export function readMediaConfig(): MediaConfig {
  try {
    const parsed = JSON.parse(readFileSync(/* turbopackIgnore: true */ filePath(), "utf8")) as Partial<MediaConfig>;
    const env = fromEnv();
    return {
      cloudflare: { ...EMPTY.cloudflare, ...env.cloudflare, ...parsed.cloudflare },
      googleDrive: { ...EMPTY.googleDrive, ...env.googleDrive, ...parsed.googleDrive },
      r2: { ...EMPTY.r2, ...env.r2, ...parsed.r2 },
    };
  } catch {
    return fromEnv();
  }
}

export function writeMediaConfig(next: MediaConfig) {
  const file = filePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(next, null, 2));
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
    r2: {
      configured: Boolean(config.r2.accessKeyId && config.r2.secretAccessKey && (config.r2.endpoint || config.r2.accountId)),
      bucket: config.r2.bucket || "vgmf-staging-main",
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
  const r2 = (body.r2 ?? {}) as Record<string, string>;
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
    r2: {
      accountId: mergeSecret(current.r2.accountId, r2.accountId),
      accessKeyId: mergeSecret(current.r2.accessKeyId, r2.accessKeyId),
      secretAccessKey: mergeSecret(current.r2.secretAccessKey, r2.secretAccessKey),
      bucket: mergeSecret(current.r2.bucket, r2.bucket) || "vgmf-staging-main",
      endpoint: mergeSecret(current.r2.endpoint, r2.endpoint),
      region: mergeSecret(current.r2.region, r2.region) || "auto",
    },
  };
  return writeMediaConfig(next);
}
