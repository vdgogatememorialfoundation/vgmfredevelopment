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
};

export type LiveChatThread = {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
  page?: string;
  messages: LiveChatMessage[];
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

export function postChatMessage(input: {
  threadId?: string;
  from: "visitor" | "staff";
  name: string;
  text: string;
  email?: string;
  page?: string;
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
  };
  const existing = threads.find((thread) => thread.id === threadId);
  if (existing) {
    existing.messages.push(message);
    existing.updatedAt = now;
    if (input.email) existing.email = input.email;
    if (input.page) existing.page = input.page;
  } else {
    threads.unshift({
      id: threadId,
      name: input.name,
      email: input.email,
      createdAt: now,
      updatedAt: now,
      page: input.page,
      messages: [message],
    });
  }
  write(THREADS_KEY, threads);
  return threadId;
}
