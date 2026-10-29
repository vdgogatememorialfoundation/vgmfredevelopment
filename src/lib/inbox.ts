import { subscribeCms } from "@/lib/cms";

const KEY = "vgmf_inbox";
const MAX = 400;

export type InboxKind = "order" | "stock" | "ticket" | "general";
export type InboxAudience = "customer" | "staff";

export type InboxItem = {
  id: string;
  audience: InboxAudience;
  email?: string;
  title: string;
  body: string;
  href?: string;
  kind: InboxKind;
  createdAt: string;
  readBy?: string[];
};

function read(): InboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as InboxItem[];
  } catch {
    return [];
  }
}

function write(list: InboxItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  window.dispatchEvent(new Event("vgmf-cms"));
}

function newId() {
  return `INB${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
}

export function getInbox(): InboxItem[] {
  return read();
}

export function subscribeInbox(onChange: () => void) {
  return subscribeCms(onChange);
}

export function pushInbox(input: {
  audience: InboxAudience;
  email?: string;
  title: string;
  body: string;
  href?: string;
  kind?: InboxKind;
}) {
  const email = input.email?.trim().toLowerCase();
  const item: InboxItem = {
    id: newId(),
    audience: input.audience,
    email: email || undefined,
    title: input.title.trim(),
    body: input.body.trim(),
    href: input.href,
    kind: input.kind ?? "general",
    createdAt: new Date().toISOString(),
    readBy: [],
  };
  write([item, ...read().filter((existing) => existing.id !== item.id)]);
  return item;
}

export function inboxFor(user: { email?: string; role?: string } | null | undefined): InboxItem[] {
  if (!user?.email) return [];
  const email = user.email.toLowerCase();
  const staff = user.role === "admin" || user.role === "coadmin" || user.role === "staff";
  return read().filter((item) => {
    if (item.audience === "staff") return staff;
    return item.email === email;
  });
}

export function unreadInboxCount(user: { email?: string; role?: string } | null | undefined) {
  if (!user?.email) return 0;
  const email = user.email.toLowerCase();
  return inboxFor(user).filter((item) => !(item.readBy ?? []).includes(email)).length;
}

export function markInboxRead(id: string, email: string) {
  const value = email.trim().toLowerCase();
  write(
    read().map((item) =>
      item.id === id
        ? { ...item, readBy: Array.from(new Set([...(item.readBy ?? []), value])) }
        : item
    )
  );
}

export function markAllInboxRead(user: { email?: string; role?: string } | null | undefined) {
  if (!user?.email) return;
  const email = user.email.toLowerCase();
  const visible = new Set(inboxFor(user).map((item) => item.id));
  write(
    read().map((item) =>
      visible.has(item.id)
        ? { ...item, readBy: Array.from(new Set([...(item.readBy ?? []), email])) }
        : item
    )
  );
}
