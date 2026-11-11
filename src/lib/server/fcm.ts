import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dataFile } from "@/lib/server/paths";
import { devicesFor, dropPushTokens } from "@/lib/server/push-devices";

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

/** Firebase service account: FCM_SERVICE_ACCOUNT_JSON env, or data/secrets/fcm-service-account.json on the server. */
function serviceAccount(): ServiceAccount | null {
  try {
    const raw = process.env.FCM_SERVICE_ACCOUNT_JSON || (existsSync(dataFile("secrets/fcm-service-account.json")) ? readFileSync(dataFile("secrets/fcm-service-account.json"), "utf8") : "");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ServiceAccount;
    return parsed.project_id && parsed.client_email && parsed.private_key ? parsed : null;
  } catch {
    return null;
  }
}

let cached: { token: string; expires: number } | null = null;

async function accessToken(account: ServiceAccount) {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key, "base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("FCM auth failed");
  cached = { token: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export function fcmReady() {
  return Boolean(serviceAccount());
}

/** Sends a push notification to every app install signed in as this customer. `url` is the in-app page to open on tap. */
export async function pushToCustomer(who: { email?: string; phone?: string; accountId?: string }, message: { title: string; body: string; url?: string }) {
  const account = serviceAccount();
  if (!account) return 0;
  const devices = devicesFor(who);
  if (!devices.length) return 0;
  const token = await accessToken(account);
  const dead: string[] = [];
  let sent = 0;
  for (const device of devices) {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          token: device.token,
          notification: { title: message.title, body: message.body.slice(0, 240) },
          data: { url: message.url ?? "/" },
          android: { priority: "high", notification: { channel_id: "orders" } },
          apns: { payload: { aps: { sound: "default" } } },
        },
      }),
    }).catch(() => null);
    if (response?.ok) sent += 1;
    else if (response && (response.status === 404 || response.status === 400)) dead.push(device.token);
  }
  dropPushTokens(dead);
  return sent;
}
