"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { Button, EmptyState, Panel, SelectInput } from "@/components/admin/AdminUI";
import { displayName, listSupportAgents } from "@/lib/admin-store";
import { formatDateTime } from "@/lib/utils";

const DEPARTMENTS = ["Support", "Shop", "Clinic", "Events", "Accounts"] as const;

type WaMessage = {
  id: string;
  at: string;
  direction: "in" | "out";
  provider: "meta" | "aisensy";
  text: string;
  status?: string;
  by?: string;
  system?: boolean;
};

type WaThread = {
  id: string;
  phone: string;
  name: string;
  provider: "meta" | "aisensy";
  lineNumber?: string;
  department?: string;
  assignedTo?: string;
  assignedName?: string;
  updatedAt: string;
  unread: number;
  lastInboundAt?: string;
  preview?: string;
  windowOpen?: boolean;
  messages: WaMessage[];
};

type DeskFilter = "all" | "mine" | "waiting" | (typeof DEPARTMENTS)[number];

function providerLabel(provider: WaThread["provider"]) {
  return provider === "aisensy" ? "AiSensy" : "Meta";
}

function lineLabel(thread: WaThread) {
  const name = providerLabel(thread.provider);
  return thread.lineNumber ? `${name} · +${thread.lineNumber}` : name;
}

function ownerLabel(thread: WaThread) {
  if (thread.assignedName) return thread.department ? `${thread.assignedName} · ${thread.department}` : thread.assignedName;
  if (thread.department) return `${thread.department} · Waiting`;
  return "Waiting";
}

function deskName(user: { firstName?: string; lastName?: string; email?: string } | null | undefined) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return name || user?.email || "Desk";
}

function Chip({ pressed, children, onClick }: { pressed: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${pressed ? "border-burgundy bg-burgundy text-white" : "border-border bg-white text-text-primary"}`}
    >
      {children}
    </button>
  );
}

export function WhatsAppInboxDesk() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<WaThread[]>([]);
  const [activeId, setActiveId] = useState("");
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [moving, setMoving] = useState(false);
  const [filter, setFilter] = useState<DeskFilter>("all");
  const [line, setLine] = useState<"all" | "meta" | "aisensy">("all");
  const [department, setDepartment] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const agents = listSupportAgents();
  const visible = threads.filter((thread) => {
    if (line !== "all" && thread.provider !== line) return false;
    if (filter === "mine") return (thread.assignedTo || "").toLowerCase() === (user?.email || "").toLowerCase();
    if (filter === "waiting") return !thread.assignedTo;
    if (filter !== "all") return thread.department === filter;
    return true;
  });
  const active = threads.find((thread) => thread.id === activeId) ?? visible[0];

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
    setDepartment(thread.department || "");
    setStaffEmail("");
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

  const move = async (action: "transfer" | "take") => {
    if (!active || moving) return;
    const agent = agents.find((item) => item.email === staffEmail);
    const assignedName = agent ? displayName(agent) || agent.email : "";
    if (action === "transfer" && !department && !staffEmail) return;
    setMoving(true);
    setNote("");
    try {
      const response = await fetch("/api/whatsapp/inbox", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          threadId: active.id,
          department: action === "transfer" ? department : "",
          assignedTo: action === "take" ? user?.email || "" : staffEmail,
          assignedName: action === "take" ? deskName(user) : assignedName,
          name: deskName(user),
        }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; noticeSent?: boolean } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.error || "The chat could not be moved.");
      if (data.error) setNote(`Chat moved. The customer was not notified: ${data.error}`);
      else if (data.noticeSent) setNote(action === "take" ? "You have this chat. The customer was told they are connected to you." : "Chat transferred. The customer was told they are connected.");
      else setNote("Chat updated.");
      if (action === "transfer") setStaffEmail("");
      await load();
    } catch (error) {
      setNote((error as Error).message);
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">WhatsApp inbox</h1>
        <p className="mt-1 text-sm text-text-muted">
          Both business numbers stay in this inbox. A Meta chat is answered on the Meta number, and an AiSensy chat is answered on the AiSensy number. Transfer a chat to a department or a staff member and the customer is told they are connected to that executive, on the same number.
          {" "}
          <Link href="/admin/settings/whatsapp" className="font-semibold text-burgundy">WhatsApp settings</Link>
        </p>
      </div>
      <Panel
        title={`${visible.length} chat${visible.length === 1 ? "" : "s"}`}
        description="A free reply works for 24 hours after the customer’s last message. After that, the desk uses the reply template or AiSensy campaign saved in settings."
      >
        {threads.length === 0 ? (
          <EmptyState text="No WhatsApp chats yet. Customers can message either business number." />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Chip pressed={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
              <Chip pressed={filter === "mine"} onClick={() => setFilter("mine")}>Mine</Chip>
              <Chip pressed={filter === "waiting"} onClick={() => setFilter("waiting")}>Waiting</Chip>
              {DEPARTMENTS.map((item) => (
                <Chip key={item} pressed={filter === item} onClick={() => setFilter(item)}>{item}</Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip pressed={line === "all"} onClick={() => setLine("all")}>Both numbers</Chip>
              <Chip pressed={line === "meta"} onClick={() => setLine("meta")}>Meta</Chip>
              <Chip pressed={line === "aisensy"} onClick={() => setLine("aisensy")}>AiSensy</Chip>
            </div>
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              {visible.length === 0 ? (
                <EmptyState text="No chats in this view." />
              ) : (
                <ul className="max-h-[560px] space-y-2 overflow-y-auto">
                  {visible.map((thread) => (
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
                        <span className="mt-0.5 block text-xs text-text-muted">{lineLabel(thread)}</span>
                        <span className="mt-0.5 block text-xs text-text-muted">+{thread.phone} · {ownerLabel(thread)}</span>
                        <span className="mt-1 block truncate text-xs text-text-muted">{thread.preview}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {active && (
                <div className="flex min-h-[420px] flex-col rounded-xl border border-border bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text-primary">{active.name}</p>
                      <p className="text-xs text-text-muted">
                        Customer +{active.phone} · {providerLabel(active.provider)} number{active.lineNumber ? ` +${active.lineNumber}` : ""}
                        {active.windowOpen ? " · reply window open" : " · outside 24-hour window"}
                      </p>
                      <p className="text-xs text-text-muted">{ownerLabel(active)}</p>
                    </div>
                    <p className="text-xs text-text-muted">{user?.email}</p>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <SelectInput value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Department">
                      <option value="">Department</option>
                      {DEPARTMENTS.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </SelectInput>
                    <SelectInput value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} aria-label="Staff member">
                      <option value="">Staff member</option>
                      {agents.map((agent) => (
                        <option key={agent.email} value={agent.email}>{displayName(agent) || agent.email}</option>
                      ))}
                    </SelectInput>
                    <Button variant="outline" disabled={moving || (!department && !staffEmail)} onClick={() => void move("transfer")}>
                      {moving ? "Moving…" : "Transfer"}
                    </Button>
                    <Button variant="outline" disabled={moving} onClick={() => void move("take")}>
                      Take this chat
                    </Button>
                  </div>
                  <div className="mt-3 flex max-h-[360px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg bg-warm-cream/60 p-3">
                    {active.messages.map((message) =>
                      message.system ? (
                        <p key={message.id} className="mx-auto max-w-[90%] text-center text-xs text-text-muted">
                          {message.text}
                          <span className="mt-0.5 block">{formatDateTime(message.at)}</span>
                        </p>
                      ) : (
                        <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.direction === "out" ? "ml-auto bg-burgundy text-white" : "bg-white text-text-primary"}`}>
                          <p className="whitespace-pre-wrap">{message.text}</p>
                          <p className={`mt-1 text-[10px] ${message.direction === "out" ? "text-white/80" : "text-text-muted"}`}>
                            {message.direction === "out" ? message.by || "Desk" : "Customer"} · {formatDateTime(message.at)}
                            {message.status ? ` · ${message.status}` : ""}
                          </p>
                        </div>
                      )
                    )}
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
          </div>
        )}
        {note && <p className="mt-3 text-sm text-text-primary">{note}</p>}
      </Panel>
    </div>
  );
}
