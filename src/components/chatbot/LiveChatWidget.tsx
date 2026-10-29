"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import {
  getLiveChatSettings,
  getThread,
  postChatMessage,
  subscribeLiveChat,
  visitorThreadId,
} from "@/lib/live-chat";
import { AIChatbot } from "@/components/chatbot/AIChatbot";

function snapshot() {
  return `${window.localStorage.getItem("vgmf_live_chat_settings") ?? ""}|${window.localStorage.getItem("vgmf_live_chat_threads") ?? ""}`;
}

export function SiteChat() {
  useSyncExternalStore(subscribeLiveChat, snapshot, () => "");
  const settings = getLiveChatSettings();
  if (!settings.enabled) return <AIChatbot />;
  return <LiveChatWidget />;
}

function LiveChatWidget() {
  const { user } = useAuth();
  const pathname = usePathname();
  const settings = getLiveChatSettings();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const threadId = typeof window === "undefined" ? "" : visitorThreadId();
  const thread = threadId ? getThread(threadId) : null;
  const bottomRef = useRef<HTMLDivElement>(null);
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : "Visitor";

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, thread?.messages.length]);

  const send = () => {
    if (!text.trim()) return;
    postChatMessage({
      from: "visitor",
      name,
      email: user?.email,
      text,
      page: pathname,
    });
    setText("");
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 rounded-full border border-gold/60 bg-gold px-5 py-3 text-sm font-semibold text-ink shadow-[0_8px_24px_rgba(196,149,74,0.35)] sm:right-6"
        >
          {settings.online ? "Live chat" : "Chat / support"}
        </button>
      )}
      {open ? (
        <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex h-[28rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-gold/40 bg-paper shadow-xl sm:right-6">
          <div className="flex items-center justify-between bg-gold/30 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Foundation support</p>
              <p className="text-xs text-ink/70">{settings.online ? "Staff are online" : "Currently offline"}</p>
            </div>
            <button type="button" className="text-sm font-semibold text-ink" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-4 text-sm">
            {!settings.online ? (
              <p className="rounded-xl bg-white p-3 text-text-muted">
                Live chat is offline. Please{" "}
                <Link href="/support" className="font-semibold text-burgundy">
                  open a support ticket
                </Link>{" "}
                and the team will reply by email.
              </p>
            ) : null}
            {(thread?.messages ?? []).map((message) => (
              <div
                key={message.id}
                className={`rounded-xl px-3 py-2 ${message.from === "visitor" ? "ml-6 bg-gold/20" : "mr-6 bg-white"}`}
              >
                <p className="text-[11px] font-semibold text-ink/60">{message.name}</p>
                <p className="text-ink">{message.text}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {settings.online ? (
            <form
              className="flex gap-2 border-t border-gold/30 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <input
                className="input-field flex-1"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Type a message"
              />
              <button type="submit" className="rounded-lg bg-burgundy px-3 py-2 text-sm font-semibold text-white">
                Send
              </button>
            </form>
          ) : (
            <div className="border-t border-gold/30 p-3">
              <Link href="/support" className="btn-primary block text-center">
                Open a ticket
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
