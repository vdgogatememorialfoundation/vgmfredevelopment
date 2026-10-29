import { addTicket, ensureCustomerAccount } from "@/lib/admin-store";

export const CHAT_UNANSWERED_MS = 45_000;

export type LiveChatSettings = {
  enabled: boolean;
  online: boolean;
};

export type LiveChatMessage = {
  id: string;
  threadId: string;
  from: "visitor" | "staff";
  name: string;
  text: string;
  at: string;
  page?: string;
  form?: boolean;
};

export type LiveChatThread = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  page?: string;
  messages: LiveChatMessage[];
  assignedTo?: string;
  assignedName?: string;
  waitingSince?: string;
  formRequested?: boolean;
  ticketId?: string;
};

const SETTINGS_KEY = "vgmf_live_chat_settings";
const THREADS_KEY = "vgmf_live_chat_threads";
const VISITOR_KEY = "vgmf_live_chat_visitor";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("vgmf-cms"));
}

export function subscribeLiveChat(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener("vgmf-cms", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("vgmf-cms", handler);
    window.removeEventListener("storage", handler);
  };
}

export function getLiveChatSettings(): LiveChatSettings {
  return { enabled: false, online: false, ...read<Partial<LiveChatSettings>>(SETTINGS_KEY, {}) };
}

export function saveLiveChatSettings(settings: LiveChatSettings) {
  write(SETTINGS_KEY, settings);
}

export function getChatThreads(): LiveChatThread[] {
  return read<LiveChatThread[]>(THREADS_KEY, []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function visitorThreadId() {
  if (typeof window === "undefined") return "";
  let id = window.sessionStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = `chat${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    window.sessionStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function getThread(id: string) {
  return getChatThreads().find((thread) => thread.id === id) ?? null;
}

function saveThreads(threads: LiveChatThread[]) {
  write(THREADS_KEY, threads);
}

export function postChatMessage(input: {
  threadId?: string;
  from: "visitor" | "staff";
  name: string;
  text: string;
  email?: string;
  phone?: string;
  page?: string;
  form?: boolean;
}) {
  const text = input.text.trim();
  if (!text) return;
  const threads = getChatThreads();
  const threadId = input.threadId || visitorThreadId();
  const now = new Date().toISOString();
  const message: LiveChatMessage = {
    id: `m${Date.now().toString(36)}`,
    threadId,
    from: input.from,
    name: input.name,
    text,
    at: now,
    page: input.page,
    form: input.form,
  };
  const existing = threads.find((thread) => thread.id === threadId);
  if (existing) {
    existing.messages.push(message);
    existing.updatedAt = now;
    if (input.email) existing.email = input.email;
    if (input.phone) existing.phone = input.phone;
    if (input.page) existing.page = input.page;
    if (input.from === "visitor" && !existing.messages.some((item) => item.from === "staff")) {
      existing.waitingSince = existing.waitingSince || now;
    }
    if (input.from === "staff" && !input.form) {
      existing.waitingSince = undefined;
    }
  } else {
    threads.unshift({
      id: threadId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      createdAt: now,
      updatedAt: now,
      page: input.page,
      waitingSince: input.from === "visitor" ? now : undefined,
      messages: [message],
    });
  }
  saveThreads(threads);
  return threadId;
}

export function transferChat(threadId: string, assignedTo: string, assignedName: string, byName: string) {
  const threads = getChatThreads();
  const thread = threads.find((item) => item.id === threadId);
  if (!thread) return;
  const now = new Date().toISOString();
  thread.assignedTo = assignedTo;
  thread.assignedName = assignedName;
  thread.updatedAt = now;
  thread.waitingSince = undefined;
  thread.messages.push({
    id: `m${Date.now().toString(36)}`,
    threadId,
    from: "staff",
    name: "VGMF Support",
    text: `${byName} transferred this chat to ${assignedName}.`,
    at: now,
  });
  saveThreads(threads);
  return thread;
}

function visitorTranscript(thread: LiveChatThread) {
  const lines = thread.messages.filter((message) => message.from === "visitor").map((message) => message.text);
  return lines.join("\n") || "Live chat with no staff reply.";
}

export function escalateIfUnanswered(threadId: string) {
  const threads = getChatThreads();
  const thread = threads.find((item) => item.id === threadId);
  if (!thread || thread.ticketId) return thread ?? null;
  const humanStaff = thread.messages.some((message) => message.from === "staff" && !message.form);
  if (humanStaff) return thread;
  const waitingFrom = thread.waitingSince || thread.createdAt;
  if (Date.now() - Date.parse(waitingFrom) < CHAT_UNANSWERED_MS) return thread;
  const now = new Date().toISOString();
  if (!thread.formRequested) {
    thread.formRequested = true;
    thread.messages.push({
      id: `m${Date.now().toString(36)}`,
      threadId,
      from: "staff",
      name: "VGMF Support",
      text: "No one has picked this up yet. Please share your details so we can open a support ticket and keep you updated.",
      at: now,
      form: true,
    });
  }
  if (thread.email) {
    const ticket = addTicket({
      name: thread.name,
      email: thread.email,
      phone: thread.phone,
      subject: "Live chat follow-up",
      body: visitorTranscript(thread),
      portal: "public",
      chatThreadId: thread.id,
    });
    thread.ticketId = ticket.id;
    thread.messages.push({
      id: `m${Date.now().toString(36)}form`,
      threadId,
      from: "staff",
      name: "VGMF Support",
      text: `Ticket ${ticket.id} is open. We will send updates to ${ticket.email}.`,
      at: now,
    });
  }
  thread.updatedAt = now;
  saveThreads(threads);
  return thread;
}

export function submitChatTicketForm(
  threadId: string,
  input: { name: string; email: string; phone?: string; subject?: string }
) {
  const threads = getChatThreads();
  const thread = threads.find((item) => item.id === threadId);
  if (!thread) return null;
  const account = ensureCustomerAccount({ name: input.name, email: input.email, phone: input.phone });
  const ticket =
    thread.ticketId
      ? null
      : addTicket({
          name: input.name,
          email: account?.email || input.email,
          phone: input.phone,
          subject: input.subject?.trim() || "Live chat follow-up",
          body: visitorTranscript(thread),
          portal: "public",
          chatThreadId: thread.id,
          userId: account?.id,
        });
  const now = new Date().toISOString();
  thread.name = input.name.trim() || thread.name;
  thread.email = account?.email || input.email;
  thread.phone = input.phone || thread.phone;
  thread.formRequested = true;
  if (ticket) thread.ticketId = ticket.id;
  thread.updatedAt = now;
  thread.messages.push({
    id: `m${Date.now().toString(36)}`,
    threadId,
    from: "staff",
    name: "VGMF Support",
    text: `Ticket ${thread.ticketId} is linked to ${thread.email}. You will receive updates by email.`,
    at: now,
  });
  saveThreads(threads);
  return thread;
}
