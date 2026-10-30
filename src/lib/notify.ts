import type { OutboxEmail } from "@/types";
import { getIntegrations, notificationEvents, type NotificationEventId } from "@/lib/integrations";
import { messageCopyFor } from "@/lib/message-templates";

const OUTBOX_KEY = "vgmf_outbox";
const MAX_LOG = 500;

export type NotificationRecord = OutboxEmail & { phone?: string; name?: string; params?: string[] };

function read(): NotificationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(OUTBOX_KEY) ?? "[]") as NotificationRecord[];
  } catch {
    return [];
  }
}

function write(list: NotificationRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(list.slice(0, MAX_LOG)));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function getNotifications(): NotificationRecord[] {
  return read();
}

function patch(id: string, update: Partial<NotificationRecord>) {
  const list = read();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return;
  list[index] = { ...list[index], ...update, updatedAt: new Date().toISOString() };
  write(list);
}

export function markNotification(id: string, status: NotificationRecord["status"]) {
  patch(id, { status, error: status === "Failed" ? read().find((item) => item.id === id)?.error : undefined });
}

export function clearNotifications(filter?: (item: NotificationRecord) => boolean) {
  write(filter ? read().filter((item) => !filter(item)) : []);
}

let counter = 0;
const newId = (prefix: string) => `${prefix}${Date.now()}${(counter++ % 1000).toString().padStart(3, "0")}`;

export function queueNotification(input: {
  to: string;
  subject: string;
  template: string;
  body: string;
  phone?: string;
  name?: string;
  params?: string[];
  replyTo?: string;
  images?: string[];
  html?: boolean;
}) {
  const now = new Date().toISOString();
  const settings = getIntegrations();
  const copy = resolvedCopy(input);
  const records: NotificationRecord[] = [];
  if (input.to) {
    records.push({
      id: newId("MAIL"),
      channel: "email",
      provider: settings.email.provider,
      to: input.to,
      subject: input.subject || copy.emailSubject,
      template: input.template,
      body: input.body || copy.emailBody,
      status: "Queued",
      sentAt: now,
      replyTo: input.replyTo,
      images: input.images?.filter(Boolean),
      html: input.html,
    });
  }
  const templateName = settings.whatsapp.mapping[input.template as NotificationEventId];
  if (settings.whatsapp.provider !== "none" && templateName && input.phone) {
    records.push({
      id: newId("WA"),
      channel: "whatsapp",
      provider: settings.whatsapp.provider,
      to: input.phone,
      phone: input.phone,
      name: input.name,
      params: input.params ?? [],
      subject: `${templateName} · ${eventLabel(input.template)}`,
      template: input.template,
      body: input.body,
      status: "Queued",
      sentAt: now,
    });
  }
  if (settings.sms.provider === "msg91" && input.phone) {
    records.push({
      id: newId("SMS"),
      channel: "sms",
      provider: "msg91",
      to: input.phone,
      phone: input.phone,
      name: input.name,
      params: input.params ?? [],
      subject: input.subject || copy.emailSubject,
      template: input.template,
      body: copy.smsBody || input.body,
      status: "Queued",
      sentAt: now,
    });
  }
  if (!records.length) return undefined;
  write([...records, ...read()]);
  for (const record of records) void deliver(record.id);
  return records[0];
}

function resolvedCopy(input: { template: string; body: string; subject: string; name?: string; to: string; phone?: string; params?: string[] }) {
  return messageCopyFor(input.template, {
    name: input.name,
    email: input.to,
    phone: input.phone,
    code: input.params?.[0],
    purpose: input.template === "otp" ? "verification" : input.template,
    subject: input.subject,
    body: input.body,
  });
}

export function eventLabel(template: string) {
  return notificationEvents.find((event) => event.id === template)?.label ?? template;
}

export async function deliver(id: string) {
  if (typeof window === "undefined") return;
  const record = read().find((item) => item.id === id);
  if (!record) return;
  const settings = getIntegrations();
  patch(id, { status: "Queued", error: undefined });
  try {
    let payload: Record<string, unknown>;
    if (record.channel === "whatsapp") {
      const template = settings.whatsapp.mapping[record.template as NotificationEventId] ?? "";
      const language = settings.whatsapp.templates.find((item) => item.name === template)?.language ?? "en";
      payload = {
        channel: "whatsapp",
        provider: settings.whatsapp.provider,
        to: record.phone ?? record.to,
        name: record.name,
        template,
        language,
        params: record.params ?? [],
        creds: settings.whatsapp,
      };
    } else if (record.channel === "sms") {
      payload = {
        channel: "sms",
        provider: "msg91",
        to: record.phone ?? record.to,
        body: record.body,
        otp: record.template === "otp" ? record.params?.[0] : undefined,
        creds: {
          ...settings.sms,
          msg91TemplateId: settings.sms.mapping[record.template as NotificationEventId] || settings.sms.msg91TemplateId,
        },
      };
    } else {
      payload = {
        channel: "email",
        provider: settings.email.provider,
        to: record.to,
        subject: record.subject,
        body: record.body,
        replyTo: record.replyTo,
        images: record.images,
        html: record.html,
        creds: settings.email,
      };
    }
    const response = await fetch("/api/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { ok: boolean; configured?: boolean; error?: string; id?: string };
    if (result.ok) {
      patch(id, { status: "Sent", live: true, providerMessageId: result.id, error: undefined });
    } else {
      patch(id, { status: "Failed", live: Boolean(result.configured), error: result.error ?? "The provider rejected the message." });
    }
  } catch (error) {
    patch(id, { status: "Failed", error: (error as Error).message || "Network error." });
  }
}
