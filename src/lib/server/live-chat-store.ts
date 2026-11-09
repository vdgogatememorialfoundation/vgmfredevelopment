import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile } from "@/lib/server/paths";

export const CHAT_DEPARTMENTS = ["Support", "Shop", "Events", "Accounts"] as const;

export type ChatKind = "text" | "image" | "video" | "voice";

export type StoredChatMessage = {
  id: string;
  threadId: string;
  from: "visitor" | "staff";
  name: string;
  text: string;
  at: string;
  kind?: ChatKind;
  mediaUrl?: string;
};

export type StoredChatThread = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  page?: string;
  messages: StoredChatMessage[];
  assignedTo?: string;
  assignedName?: string;
  department?: string;
  status: "open" | "closed";
  ticketId?: string;
  closedAt?: string;
  /** Customer-facing reference, unique per chat. */
  ref?: string;
  participants?: { email: string; name: string; joinedAt: string }[];
  firstJoinedAt?: string;
};

export type SupportDepartment = { name: string; agents: string[] };

export function chatRef(thread: Pick<StoredChatThread, "id" | "createdAt">) {
  const day = (thread.createdAt || "").slice(2, 10).replace(/-/g, "");
  return `CH-${day}-${thread.id.replace(/^chat/, "").toUpperCase()}`;
}

const DEPT_FILE = dataFile("support-departments.json");

export function listDepartments(): SupportDepartment[] {
  try {
    const rows = JSON.parse(readFileSync(DEPT_FILE, "utf8")) as SupportDepartment[];
    if (Array.isArray(rows) && rows.length) return rows.filter((row) => row?.name);
  } catch {
    /* defaults */
  }
  return CHAT_DEPARTMENTS.map((name) => ({ name, agents: [] }));
}

export function saveDepartments(rows: SupportDepartment[]) {
  const clean = rows
    .map((row) => ({ name: String(row?.name ?? "").trim(), agents: Array.isArray(row?.agents) ? row.agents.map((item) => String(item).trim().toLowerCase()).filter(Boolean) : [] }))
    .filter((row) => row.name);
  mkdirSync(dirname(DEPT_FILE), { recursive: true });
  writeFileSync(DEPT_FILE, JSON.stringify(clean));
  return clean;
}

type Store = { threads: StoredChatThread[]; lastAgent: number };

const FILE = dataFile("live-chat.json");

function empty(): Store {
  return { threads: [], lastAgent: 0 };
}

function read(): Store {
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Store;
    if (parsed && Array.isArray(parsed.threads)) {
      for (const thread of parsed.threads) thread.ref ||= chatRef(thread);
      return { threads: parsed.threads, lastAgent: parsed.lastAgent || 0 };
    }
  } catch {
    /* missing */
  }
  return empty();
}

function write(store: Store) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(store));
}

function nid(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function listChatThreads(filter?: { email?: string; id?: string; staff?: boolean }) {
  const store = read();
  let rows = store.threads;
  if (filter?.id) rows = rows.filter((thread) => thread.id === filter.id);
  else if (filter?.email && !filter.staff) rows = rows.filter((thread) => (thread.email || "").toLowerCase() === filter.email);
  return rows.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getChatThread(id: string) {
  return read().threads.find((thread) => thread.id === id) ?? null;
}

export function postLiveMessage(input: {
  threadId?: string;
  from: "visitor" | "staff";
  name: string;
  text?: string;
  email?: string;
  phone?: string;
  page?: string;
  kind?: ChatKind;
  mediaUrl?: string;
}) {
  const store = read();
  const now = new Date().toISOString();
  const threadId = input.threadId || nid("chat");
  const message: StoredChatMessage = {
    id: nid("m"),
    threadId,
    from: input.from,
    name: input.name,
    text: (input.text || "").trim(),
    at: now,
    kind: input.kind || "text",
    mediaUrl: input.mediaUrl,
  };
  let thread = store.threads.find((item) => item.id === threadId);
  if (!thread) {
    thread = {
      id: threadId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      createdAt: now,
      updatedAt: now,
      page: input.page,
      messages: [message],
      status: "open",
    };
    thread.ref = chatRef(thread);
    store.threads.unshift(thread);
  } else {
    if (thread.status === "closed" && input.from === "visitor") thread.status = "open";
    thread.messages.push(message);
    thread.updatedAt = now;
    if (input.email) thread.email = input.email;
    if (input.phone) thread.phone = input.phone;
    if (input.page) thread.page = input.page;
  }
  write(store);
  return thread;
}

export function takeChatThread(threadId: string, agentEmail: string, agentName: string) {
  const store = read();
  const thread = store.threads.find((item) => item.id === threadId);
  if (!thread) return null;
  const now = new Date().toISOString();
  thread.assignedTo = agentEmail;
  thread.assignedName = agentName;
  thread.status = "open";
  thread.updatedAt = now;
  thread.firstJoinedAt ||= now;
  thread.participants = [...(thread.participants ?? []).filter((item) => item.email !== agentEmail), { email: agentEmail, name: agentName, joinedAt: now }];
  thread.messages.push({
    id: nid("m"),
    threadId,
    from: "staff",
    name: agentName,
    text: `Namaste, I am ${agentName} from Foundation Support. How can I help you today?`,
    at: now,
    kind: "text",
  });
  write(store);
  return thread;
}

export function closeChatThread(threadId: string, agentName: string) {
  const store = read();
  const thread = store.threads.find((item) => item.id === threadId);
  if (!thread) return null;
  const now = new Date().toISOString();
  thread.status = "closed";
  thread.closedAt = now;
  thread.updatedAt = now;
  thread.messages.push({
    id: nid("m"),
    threadId,
    from: "staff",
    name: agentName,
    text: `${agentName} closed this chat. You can write again if you need more help.`,
    at: now,
    kind: "text",
  });
  write(store);
  return thread;
}

export function transferChatThread(threadId: string, assignedTo: string, assignedName: string, byName: string, department?: string) {
  const store = read();
  const thread = store.threads.find((item) => item.id === threadId);
  if (!thread) return null;
  const now = new Date().toISOString();
  thread.assignedTo = assignedTo || undefined;
  thread.assignedName = assignedName;
  if (department) thread.department = department;
  thread.updatedAt = now;
  thread.messages.push({
    id: nid("m"),
    threadId,
    from: "staff",
    name: byName,
    text: department
      ? `${byName} transferred this chat to the ${department} desk${assignedName ? ` (${assignedName})` : ""}.`
      : `${byName} transferred this chat to ${assignedName}.`,
    at: now,
    kind: "text",
  });
  write(store);
  return thread;
}

/** Bring another agent into the same chat without handing it over. */
export function inviteChatAgent(threadId: string, agentEmail: string, agentName: string, byName: string) {
  const store = read();
  const thread = store.threads.find((item) => item.id === threadId);
  if (!thread || !agentEmail) return null;
  const now = new Date().toISOString();
  thread.participants = [...(thread.participants ?? []).filter((item) => item.email !== agentEmail), { email: agentEmail, name: agentName, joinedAt: now }];
  thread.firstJoinedAt ||= now;
  thread.updatedAt = now;
  thread.messages.push({ id: nid("m"), threadId, from: "staff", name: byName, text: `${byName} added ${agentName} to this chat.`, at: now, kind: "text" });
  write(store);
  return thread;
}

export function nextAgentName(agents: { email: string; name: string }[]) {
  if (!agents.length) return { email: "", name: "next available agent" };
  const store = read();
  store.lastAgent = (store.lastAgent + 1) % agents.length;
  write(store);
  return agents[store.lastAgent];
}

export function visitorTranscript(thread: StoredChatThread) {
  return thread.messages.filter((item) => item.from === "visitor").map((item) => item.text || item.kind).join("\n") || "Live chat.";
}

export function markThreadTicket(threadId: string, ticketId: string) {
  const store = read();
  const thread = store.threads.find((item) => item.id === threadId);
  if (!thread) return null;
  thread.ticketId = ticketId;
  thread.updatedAt = new Date().toISOString();
  write(store);
  return thread;
}
