import { createHash, createHmac } from "node:crypto";
import { readMediaConfig } from "@/lib/server/media-config";

function sha256Hex(data: Buffer | string) {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string) {
  return createHmac("sha256", key).update(data).digest();
}

function amzStamp(now = new Date()) {
  const compact = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz: compact, date: compact.slice(0, 8) };
}

function encodePath(pathname: string) {
  return pathname
    .split("/")
    .map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

export function r2Settings() {
  const config = readMediaConfig();
  const accountId = config.r2.accountId || config.cloudflare.accountId;
  const endpoint = (config.r2.endpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")).replace(/\/$/, "");
  const bucket = config.r2.bucket || "vgmf-staging-main";
  return {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
    bucket,
    endpoint,
    region: config.r2.region || "auto",
    configured: Boolean(config.r2.accessKeyId && config.r2.secretAccessKey && bucket && endpoint),
  };
}

async function signedRequest(method: "GET" | "PUT" | "HEAD", key: string, body?: Buffer, contentType?: string) {
  const settings = r2Settings();
  if (!settings.configured) return null;
  const url = new URL(`${settings.endpoint}/${settings.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`);
  const { amz, date } = amzStamp();
  const payloadHash = sha256Hex(body ?? "");
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
  };
  if (contentType) headers["content-type"] = contentType;
  const signedNames = Object.keys(headers).sort();
  const canonicalHeaders = signedNames.map((name) => `${name}:${headers[name]}\n`).join("");
  const signedHeaders = signedNames.join(";");
  const canonicalRequest = [method, encodePath(url.pathname), "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${date}/${settings.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amz, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${settings.secretAccessKey}`, date), settings.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return fetch(url, {
    method,
    headers: {
      authorization: `AWS4-HMAC-SHA256 Credential=${settings.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amz,
      ...(contentType ? { "content-type": contentType } : {}),
    },
    body: body ? new Uint8Array(body) : undefined,
  });
}

export async function putR2Object(key: string, body: Buffer, contentType: string) {
  const response = await signedRequest("PUT", key, body, contentType || "application/octet-stream");
  if (!response) return false;
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail.trim() || `R2 upload failed (${response.status}).`);
  }
  return true;
}

export async function getR2Object(key: string) {
  const response = await signedRequest("GET", key);
  if (!response || response.status === 404) return null;
  if (!response.ok) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    body: bytes,
    type: response.headers.get("content-type") || "application/octet-stream",
  };
}
