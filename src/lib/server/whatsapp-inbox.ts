import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";
import { readKv } from "@/lib/server/db";
import { sendAiSensy, sendAiSensySession, sendMetaTemplate, sendMetaText } from "@/lib/server/providers";

export type WaProvider = "meta" | "aisensy";

export type WaMessage = {
  id: string;
  at: string;
  direction: "in" | "out";
  provider: WaProvider;
  text: string;
  status?: string;
  externalId?: string;
  by?: string;
};

export type WaThread = {
  id: string;
  phone: string;
  name: string;
  provider: WaProvider;
  updatedAt: string;
  unread: number;
  lastInboundAt?: string;
  messages: WaMessage[];
};

type Store = { threads: WaThread[] };

const FILE = () => dataFile("whatsapp-inbox.json");
const CREDS = () => dataFile("whatsapp-creds.json");
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_THREADS = 400;
const MAX_MESSAGES = 200;

const CRED_KEYS = [
  "provider",
  "metaAppId",
  "metaWabaId",
  "metaPhoneNumberId",
  "metaAccessToken",
  "metaApiVersion",
  "metaVerifyToken",
  "metaAppSecret",
  "metaReplyTemplate",
  "aisensyApiKey",
  "aisensyProjectId",
  "aisensyAppPassword",
  "aisensyReplyCampaign",
  "aisensyWebhookToken",
] as const;

export function waPhone(raw: string) {
  let digits = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

function nid() {
  return `wa${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function readStore(): Store {
  try {
    const parsed = JSON.parse(readFileSync(FILE(), "utf8")) as Store;
    if (parsed && Array.isArray(parsed.threads)) return parsed;
  } catch {
    /* missing */
  }
  return { threads: [] };
}

function writeStore(store: Store) {
  const file = FILE();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(store));
}

export function listWhatsAppThreads() {
  return readStore()
    .threads.slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((thread) => ({
      ...thread,
      preview: thread.messages[thread.messages.length - 1]?.text ?? "",
      windowOpen: serviceWindowOpen(thread),
    }));
}

export function serviceWindowOpen(thread: { lastInboundAt?: string }, now = Date.now()) {
  const at = Date.parse(thread.lastInboundAt || "");
  return Number.isFinite(at) && now - at < WINDOW_MS;
}

function upsert(store: Store, input: {
  provider: WaProvider;
  phone: string;
  name?: string;
  text: string;
  direction: "in" | "out";
  externalId?: string;
  at?: string;
  by?: string;
  status?: string;
}) {
  const phone = waPhone(input.phone);
  if (!phone || phone.length < 8) return null;
  const text = input.text.replace(/\s+/g, " ").trim().slice(0, 4000);
  if (!text) return null;
  let thread = store.threads.find((item) => item.id === phone);
  if (!thread) {
    thread = {
      id: phone,
      phone,
      name: input.name?.trim() || `+${phone}`,
      provider: input.provider,
      updatedAt: input.at || new Date().toISOString(),
      unread: 0,
      messages: [],
    };
    store.threads.unshift(thread);
  }
  if (input.externalId && thread.messages.some((message) => message.externalId === input.externalId)) return thread;
  if (input.direction === "out") {
    const last = thread.messages[thread.messages.length - 1];
    const at = Date.parse(input.at || new Date().toISOString());
    if (last?.direction === "out" && last.text === text && Number.isFinite(at) && Math.abs(at - Date.parse(last.at)) < 60_000) {
      if (input.externalId && !last.externalId) last.externalId = input.externalId;
      return thread;
    }
  }
  const at = input.at || new Date().toISOString();
  thread.messages.push({
    id: nid(),
    at,
    direction: input.direction,
    provider: input.provider,
    text,
    status: input.status,
    externalId: input.externalId || undefined,
    by: input.by,
  });
  if (thread.messages.length > MAX_MESSAGES) thread.messages.splice(0, thread.messages.length - MAX_MESSAGES);
  thread.updatedAt = at;
  thread.provider = input.provider;
  if (input.name?.trim()) thread.name = input.name.trim().slice(0, 80);
  if (input.direction === "in") {
    thread.lastInboundAt = at;
    thread.unread += 1;
  }
  store.threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (store.threads.length > MAX_THREADS) store.threads.length = MAX_THREADS;
  return thread;
}

export function ingestWhatsAppMessage(input: Parameters<typeof upsert>[1]) {
  const store = readStore();
  const thread = upsert(store, input);
  if (thread) writeStore(store);
  return thread;
}

export function markWhatsAppRead(threadId: string) {
  const store = readStore();
  const thread = store.threads.find((item) => item.id === threadId);
  if (!thread) return null;
  thread.unread = 0;
  writeStore(store);
  return thread;
}

export function markWhatsAppExternalStatus(externalId: string, status: string) {
  if (!externalId || !status) return;
  const store = readStore();
  let changed = false;
  for (const thread of store.threads) {
    const message = thread.messages.find((item) => item.externalId === externalId);
    if (!message) continue;
    message.status = status;
    changed = true;
  }
  if (changed) writeStore(store);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (!record) return "";
  if (typeof record.body === "string") return record.body;
  if (typeof record.text === "string") return record.text;
  if (typeof record.caption === "string") return record.caption;
  return "";
}

function metaMessageText(message: Record<string, unknown>) {
  const type = String(message.type || "text");
  if (type === "text") return textOf(message.text);
  if (type === "button") return textOf(asRecord(message.button)?.text) || textOf(message.button);
  if (type === "interactive") {
    const interactive = asRecord(message.interactive);
    const button = asRecord(interactive?.button_reply);
    const list = asRecord(interactive?.list_reply);
    return String(button?.title || list?.title || interactive?.type || "Button");
  }
  const media = asRecord(message[type]);
  const caption = textOf(media?.caption);
  const label =
    type === "image" ? "Image" : type === "audio" || type === "voice" ? "Voice message" : type === "video" ? "Video" : type === "document" ? String(media?.filename || "Document") : type === "location" ? "Location" : type === "sticker" ? "Sticker" : type;
  return caption ? `${label}: ${caption}` : `[${label}]`;
}

export type InboundWa = {
  provider: WaProvider;
  phone: string;
  name?: string;
  text: string;
  externalId?: string;
  at?: string;
  direction: "in" | "out";
};

export function parseMetaWebhook(body: unknown): { messages: InboundWa[]; statuses: { id: string; status: string }[] } {
  const messages: InboundWa[] = [];
  const statuses: { id: string; status: string }[] = [];
  const root = asRecord(body);
  const entries = Array.isArray(root?.entry) ? root.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(asRecord(entry)?.changes) ? (asRecord(entry)?.changes as unknown[]) : [];
    for (const change of changes) {
      const value = asRecord(asRecord(change)?.value);
      if (!value) continue;
      const names = new Map<string, string>();
      for (const contact of Array.isArray(value.contacts) ? value.contacts : []) {
        const row = asRecord(contact);
        const wa = waPhone(String(row?.wa_id || ""));
        const name = String(asRecord(row?.profile)?.name || "");
        if (wa && name) names.set(wa, name);
      }
      for (const raw of Array.isArray(value.messages) ? value.messages : []) {
        const message = asRecord(raw);
        if (!message) continue;
        const phone = waPhone(String(message.from || ""));
        const stamp = Number(message.timestamp);
        messages.push({
          provider: "meta",
          phone,
          name: names.get(phone),
          text: metaMessageText(message),
          externalId: String(message.id || ""),
          at: Number.isFinite(stamp) && stamp > 0 ? new Date(stamp * 1000).toISOString() : undefined,
          direction: "in",
        });
      }
      for (const raw of Array.isArray(value.statuses) ? value.statuses : []) {
        const status = asRecord(raw);
        if (!status?.id) continue;
        statuses.push({ id: String(status.id), status: String(status.status || "") });
      }
    }
  }
  return { messages, statuses };
}

function firstString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

export function parseAiSensyWebhook(body: unknown): InboundWa[] {
  const root = asRecord(body);
  if (!root) return [];
  const data = asRecord(root.data) ?? root;
  const message = asRecord(data.message) ?? asRecord(root.message) ?? data;
  const content = asRecord(message.message_content) ?? asRecord(message.content) ?? message;
  const phone = waPhone(
    firstString(message, ["phone_number", "phone", "waId", "wa_id", "from", "destination", "sender"]) ||
      firstString(data, ["phone_number", "phone", "waId", "from"]) ||
      firstString(root, ["phone_number", "phone", "waId", "from"])
  );
  const text =
    firstString(content, ["text", "body", "caption"]) ||
    firstString(message, ["text", "body", "message"]) ||
    firstString(root, ["text", "message", "body"]);
  if (!phone || !text) return [];
  const sender = firstString(message, ["sender", "direction"]).toUpperCase();
  const direction: "in" | "out" = sender === "AGENT" || sender === "BUSINESS" || sender === "API" || sender === "OUT" ? "out" : "in";
  const stamp = Date.parse(firstString(message, ["sent_at", "created_at"]) || firstString(root, ["created_at", "timestamp"]));
  return [
    {
      provider: "aisensy",
      phone,
      name: firstString(message, ["userName", "name", "contact_name"]) || firstString(data, ["userName", "name"]) || firstString(root, ["name", "userName"]),
      text,
      externalId: firstString(message, ["id", "submitted_message_id"]) || firstString(root, ["id"]),
      at: Number.isFinite(stamp) ? new Date(stamp).toISOString() : undefined,
      direction,
    },
  ];
}

export function applyWhatsAppWebhook(kind: "meta" | "aisensy", body: unknown) {
  if (kind === "meta") {
    const parsed = parseMetaWebhook(body);
    for (const status of parsed.statuses) markWhatsAppExternalStatus(status.id, status.status);
    const threads = parsed.messages.map((message) => ingestWhatsAppMessage(message)).filter(Boolean);
    return { messages: parsed.messages.length, statuses: parsed.statuses.length, threads: threads.length };
  }
  const messages = parseAiSensyWebhook(body);
  const threads = messages.map((message) => ingestWhatsAppMessage(message)).filter(Boolean);
  return { messages: messages.length, statuses: 0, threads: threads.length };
}

function readCredsFile() {
  try {
    const parsed = JSON.parse(readFileSync(CREDS(), "utf8")) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveWhatsAppCredsFile(input: unknown) {
  const source = asRecord(input) ?? {};
  const next: Record<string, string> = {};
  for (const key of CRED_KEYS) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) next[key] = value.trim();
  }
  const file = CREDS();
  mkdirSync(dirname(file), { recursive: true });
  const previous = readCredsFile();
  const merged = { ...previous };
  for (const [key, value] of Object.entries(next)) merged[key] = value;
  writeFileSync(file, JSON.stringify(merged));
}

export function whatsAppVerifyToken() {
  const fromEnv = process.env.META_WA_VERIFY_TOKEN?.trim() || "";
  const fromFile = String(readCredsFile().metaVerifyToken || "").trim();
  return { env: fromEnv, file: fromFile };
}

export function aisensyWebhookToken() {
  return String(readCredsFile().aisensyWebhookToken || process.env.AISENSY_WEBHOOK_TOKEN || "").trim();
}

export function metaAppSecret() {
  return String(readCredsFile().metaAppSecret || process.env.META_WA_APP_SECRET || "").trim();
}

export async function loadWhatsAppCreds() {
  const stored = (await readKv<Record<string, unknown>>("admin", "notify-creds")) ?? {};
  const fromKv = asRecord(stored.whatsapp) ?? {};
  const file = readCredsFile();
  const merged: Record<string, string> = {};
  for (const key of CRED_KEYS) {
    const kv = fromKv[key];
    const disk = file[key];
    const value = typeof kv === "string" && kv.trim() ? kv.trim() : typeof disk === "string" ? disk.trim() : "";
    if (value) merged[key] = value;
  }
  return merged;
}

export async function replyOnWhatsApp(threadId: string, text: string, by: string) {
  const body = text.replace(/\s+/g, " ").trim();
  if (!body) throw new Error("Type a reply first.");
  const existing = readStore().threads.find((item) => item.id === threadId);
  if (!existing) throw new Error("That chat is no longer in the inbox.");
  const creds = await loadWhatsAppCreds();
  const within = serviceWindowOpen(existing);
  let sent: { id: string; provider: WaProvider } | null = null;
  if (existing.provider === "aisensy") {
    if (within) {
      try {
        sent = await sendAiSensySession(creds, { to: existing.phone, body });
      } catch (error) {
        if (!creds.aisensyReplyCampaign) throw error;
      }
    }
    if (!sent) {
      const campaign = creds.aisensyReplyCampaign || "";
      if (!campaign) {
        throw new Error(
          within
            ? "Add the AiSensy project id and app password under WhatsApp settings to reply inside the 24-hour window."
            : "This chat is outside the 24-hour window. Add an AiSensy reply campaign (one variable) under WhatsApp settings."
        );
      }
      const campaignSent = await sendAiSensy(creds, { to: existing.phone, campaign, name: existing.name, params: [body.slice(0, 1024)] });
      sent = campaignSent ? { id: campaignSent.id, provider: "aisensy" } : null;
      if (!sent) throw new Error("Add the AiSensy API key under WhatsApp settings.");
    }
  } else {
    if (within) {
      try {
        sent = await sendMetaText(creds, { to: existing.phone, body });
      } catch (error) {
        if (!creds.metaReplyTemplate) throw error;
      }
    }
    if (!sent) {
      const template = creds.metaReplyTemplate || "";
      if (!template) {
        throw new Error(
          within
            ? "Add the Meta phone number ID and access token under WhatsApp settings."
            : "This chat is outside the 24-hour window. Add a Meta reply template with one variable under WhatsApp settings."
        );
      }
      const templateSent = await sendMetaTemplate(creds, { to: existing.phone, template, params: [body.slice(0, 1024)] });
      sent = templateSent ? { id: templateSent.id, provider: "meta" } : null;
      if (!sent) throw new Error("Add the Meta phone number ID and access token under WhatsApp settings.");
    }
  }
  const store = readStore();
  const updated = upsert(store, {
    provider: sent.provider,
    phone: existing.phone,
    name: existing.name,
    text: body,
    direction: "out",
    externalId: sent.id || undefined,
    by,
    status: "sent",
  });
  if (updated) updated.unread = 0;
  writeStore(store);
  return updated;
}
