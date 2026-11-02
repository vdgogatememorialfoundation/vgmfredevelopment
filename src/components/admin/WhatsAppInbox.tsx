"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { Button, EmptyState, Panel } from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/utils";

type WaMessage = {
  id: string;
  at: string;
  direction: "in" | "out";
  provider: "meta" | "aisensy";
  text: string;
  status?: string;
  by?: string;
};

type WaThread = {
  id: string;
  phone: string;
  name: string;
  provider: "meta" | "aisensy";
  updatedAt: string;
  unread: number;
  lastInboundAt?: string;
  preview?: string;
  windowOpen?: boolean;
  messages: WaMessage[];
};

function providerLabel(provider: WaThread["provider"]) {
  return provider === "aisensy" ? "AiSensy" : "Meta";
}

export function WhatsAppInboxDesk() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<WaThread[]>([]);
  const [activeId, setActiveId] = useState("");
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const active = threads.find((thread) => thread.id === activeId) ?? threads[0];

  const load = useCallback(async () => {
    const response = await fetch("/api/whatsapp/inbox", { credentials: "same-origin", cache: "no-store" });
    if (response.status === 401) {
      setNote("Sign in to the desk to open the WhatsApp inbox.");
      return;
    }
    const data = (await response.json().catch(() => null)) as { ok?: boolean; threads?: WaThread[]; error?: string } | null;
    if (!data?.ok || !data.threads) {
      setNote(data?.error || "The inbox could not be loaded.");
      return;
    }
    setThreads(data.threads);
    setActiveId((current) => current || data.threads?.[0]?.id || "");
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const openThread = (thread: WaThread) => {
    setActiveId(thread.id);
    setNote("");
    if (thread.unread > 0) {
      void fetch("/api/whatsapp/inbox", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "read", threadId: thread.id }),
      }).then(() => load());
    }
  };

  const send = async () => {
    if (!active || !reply.trim() || sending) return;
    setSending(true);
    setNote("");
    try {
      const response = await fetch("/api/whatsapp/inbox", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reply", threadId: active.id, text: reply.trim() }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.error || "The reply was not sent.");
      setReply("");
      setNote("Sent on WhatsApp.");
      await load();
    } catch (error) {
      setNote((error as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">WhatsApp inbox</h1>
        <p className="mt-1 text-sm text-text-muted">
          Customer messages from Meta Cloud API and AiSensy land here. Reply from this desk and the customer receives it on WhatsApp.
          {" "}
          <Link href="/admin/settings/whatsapp" className="font-semibold text-burgundy">WhatsApp settings</Link>
        </p>
      </div>
      <Panel
        title={`${threads.length} chat${threads.length === 1 ? "" : "s"}`}
        description="A free reply works for 24 hours after the customer’s last message. After that, the desk uses the reply template or AiSensy campaign saved in settings."
      >
        {threads.length === 0 ? (
          <EmptyState text="No WhatsApp chats yet. Save the Meta verify token and the AiSensy webhook URL, then send a message to the business number." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <ul className="max-h-[560px] space-y-2 overflow-y-auto">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => openThread(thread)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${active?.id === thread.id ? "border-burgundy bg-burgundy/5" : "border-border bg-white"}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text-primary">{thread.name}</span>
                      {thread.unread > 0 && (
                        <span className="rounded-full bg-burgundy px-1.5 text-[10px] font-bold text-white">{thread.unread}</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {providerLabel(thread.provider)} · +{thread.phone}
                    </span>
                    <span className="mt-1 block truncate text-xs text-text-muted">{thread.preview}</span>
                  </button>
                </li>
              ))}
            </ul>
            {active && (
              <div className="flex min-h-[420px] flex-col rounded-xl border border-border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-text-primary">{active.name}</p>
                    <p className="text-xs text-text-muted">
                      +{active.phone} · {providerLabel(active.provider)}
                      {active.windowOpen ? " · reply window open" : " · outside 24-hour window"}
                    </p>
                  </div>
                  <p className="text-xs text-text-muted">{user?.email}</p>
                </div>
                <div className="mt-3 flex max-h-[360px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg bg-warm-cream/60 p-3">
                  {active.messages.map((message) => (
                    <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.direction === "out" ? "ml-auto bg-burgundy text-white" : "bg-white text-text-primary"}`}>
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      <p className={`mt-1 text-[10px] ${message.direction === "out" ? "text-white/80" : "text-text-muted"}`}>
                        {message.direction === "out" ? message.by || "Desk" : "Customer"} · {formatDateTime(message.at)}
                        {message.status ? ` · ${message.status}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <textarea
                    className="input-field min-h-20 flex-1"
                    rows={2}
                    value={reply}
                    placeholder={active.windowOpen ? "Write a reply" : "Write a reply. It will be sent with the saved template or campaign."}
                    onChange={(event) => setReply(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <Button disabled={sending || !reply.trim()} onClick={() => void send()}>
                    {sending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {note && <p className="mt-3 text-sm text-text-primary">{note}</p>}
      </Panel>
    </div>
  );
}
