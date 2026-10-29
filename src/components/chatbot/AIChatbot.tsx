"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/LanguageProvider";
import { useAuth } from "@/components/auth/AuthContext";
import { answerQuestion } from "@/lib/chat-knowledge";
import SiteLogo from "@/components/common/SiteLogo";
import {
  CHAT_UNANSWERED_MS,
  escalateIfUnanswered,
  getLiveChatSettings,
  getThread,
  postChatMessage,
  submitChatTicketForm,
  subscribeLiveChat,
  visitorThreadId,
} from "@/lib/live-chat";

interface ChatMessage {
  role: "bot" | "user";
  text: string;
}

const QUICK_QUESTIONS = [
  "What is the next seminar?",
  "Latest articles",
  "How can I order a book?",
  "Track my order",
  "How do I open a support ticket?",
];

const POPUP_KEY = "vgmf_chat_assist_dismissed";

function chatSnapshot() {
  return `${window.localStorage.getItem("vgmf_live_chat_settings") ?? ""}|${window.localStorage.getItem("vgmf_live_chat_threads") ?? ""}`;
}

export function AIChatbot() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const pathname = usePathname();
  useSyncExternalStore(subscribeLiveChat, chatSnapshot, () => "");
  const live = getLiveChatSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"ai" | "live">("ai");
  const [showPopup, setShowPopup] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      text: t("chat.greeting"),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [ticketForm, setTicketForm] = useState({ name: "", email: "", phone: "", subject: "" });
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadId = typeof window === "undefined" ? "" : visitorThreadId();
  const thread = threadId ? getThread(threadId) : null;
  const visitorName = user ? `${user.firstName} ${user.lastName}`.trim() : "Visitor";

  useEffect(() => {
    setMessages((current) => {
      if (current.length === 1 && current[0].role === "bot") {
        return [{ role: "bot", text: t("chat.greeting") }];
      }
      return current;
    });
  }, [locale, t]);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen, isTyping, mode, thread?.messages.length]);

  useEffect(() => {
    if (isOpen || window.sessionStorage.getItem(POPUP_KEY)) return;
    const timer = window.setTimeout(() => setShowPopup(true), 6000);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || mode !== "live" || !live.online || !threadId) return;
    const timer = window.setInterval(() => escalateIfUnanswered(threadId), 4000);
    escalateIfUnanswered(threadId);
    return () => window.clearInterval(timer);
  }, [isOpen, mode, live.online, threadId, thread?.messages.length]);

  const dismissPopup = () => {
    setShowPopup(false);
    window.sessionStorage.setItem(POPUP_KEY, "1");
  };

  const handleSend = (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question) return;

    setMessages((current) => [...current, { role: "user", text: question }]);
    setInput("");
    setIsTyping(true);

    window.setTimeout(() => {
      const answer = answerQuestion(question);
      setMessages((current) => [
        ...current,
        {
          role: "bot",
          text:
            answer ??
            "I can help with events, shop orders, tickets, sign-in, certificates, clinics and Foundation info. Please try another question, or open /support — or talk to a person when live chat is on.",
        },
      ]);
      setIsTyping(false);
    }, 700);
  };

  const sendLive = () => {
    if (!liveText.trim()) return;
    postChatMessage({
      from: "visitor",
      name: visitorName,
      email: user?.email,
      phone: user?.phone,
      text: liveText,
      page: pathname,
    });
    setLiveText("");
  };

  const openChat = () => {
    setIsOpen(true);
    dismissPopup();
  };

  return (
    <>
      {!isOpen && showPopup && (
        <div className="fixed right-4 bottom-[5.5rem] z-50 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-gold/40 bg-white p-4 shadow-xl sm:right-6">
          <p className="text-sm font-semibold text-ink">{t("chat.assistPopup")}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded-lg bg-burgundy px-3 py-1.5 text-xs font-semibold text-white" onClick={openChat}>
              {t("chat.assistCta")}
            </button>
            <button type="button" className="text-xs font-semibold text-text-muted" onClick={dismissPopup}>
              Not now
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <button
          type="button"
          onClick={openChat}
          aria-label={t("chat.open")}
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-gold/60 bg-white text-ink shadow-[0_8px_24px_rgba(11,31,58,0.12)] transition hover:border-gold sm:right-6"
        >
          <SiteLogo size={40} className="rounded-full bg-white" />
        </button>
      )}

      {isOpen && (
        <div className="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex max-h-[min(40rem,calc(100dvh-4.5rem))] w-[calc(100vw-1.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-gold/40 bg-white shadow-2xl sm:right-6">
          <div className="flex items-center justify-between border-b border-gold/40 bg-paper px-4 py-3.5 text-ink">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-gold/50 bg-white p-0.5">
                <SiteLogo size={40} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-serif text-sm font-semibold tracking-wide">{mode === "live" ? "Foundation support" : t("chat.assistant")}</p>
                <p className="truncate text-[10px] uppercase tracking-[0.14em] text-gold">{t("chat.brand")}</p>
                <p className="text-[11px] text-ink/70">
                  {mode === "live" ? (live.online ? "Staff are online" : "Currently offline") : t("chat.replies")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t("chat.close")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink/70 transition hover:bg-white hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {live.enabled && (
            <div className="flex gap-2 border-b border-border bg-white px-4 py-2">
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === "ai" ? "bg-burgundy text-white" : "text-text-muted"}`}
                onClick={() => setMode("ai")}
              >
                {t("chat.backAi")}
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === "live" ? "bg-burgundy text-white" : "text-text-muted"}`}
                onClick={() => setMode("live")}
              >
                {t("chat.talkPerson")}
              </button>
            </div>
          )}

          {mode === "live" ? (
            <>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-warm-cream px-4 py-4 text-sm">
                {!live.online ? (
                  <p className="rounded-xl bg-white p-3 text-text-muted">
                    Live chat is offline. Please{" "}
                    <Link href="/support" className="font-semibold text-burgundy">
                      open a support ticket
                    </Link>{" "}
                    and the team will reply by email.
                  </p>
                ) : (
                  <p className="text-xs text-text-muted">
                    If nobody replies within {Math.round(CHAT_UNANSWERED_MS / 1000)} seconds, we open a 12-digit ticket and send a short form.
                  </p>
                )}
                {(thread?.messages ?? []).map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-xl px-3 py-2 ${message.from === "visitor" ? "ml-6 bg-gold/20" : "mr-6 bg-white"}`}
                  >
                    <p className="text-[11px] font-semibold text-ink/60">{message.name}</p>
                    <p className="text-ink">{message.text}</p>
                  </div>
                ))}
                {thread?.formRequested && !thread.ticketId ? (
                  <form
                    className="space-y-2 rounded-xl border border-border bg-white p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!ticketForm.email.trim()) return;
                      submitChatTicketForm(thread.id, {
                        name: ticketForm.name || visitorName,
                        email: ticketForm.email,
                        phone: ticketForm.phone,
                        subject: ticketForm.subject,
                      });
                    }}
                  >
                    <p className="text-xs font-semibold text-ink">Ticket details</p>
                    <input className="input-field" placeholder="Name" value={ticketForm.name} onChange={(event) => setTicketForm({ ...ticketForm, name: event.target.value })} />
                    <input className="input-field" placeholder="Email" type="email" required value={ticketForm.email} onChange={(event) => setTicketForm({ ...ticketForm, email: event.target.value })} />
                    <input className="input-field" placeholder="Phone" value={ticketForm.phone} onChange={(event) => setTicketForm({ ...ticketForm, phone: event.target.value })} />
                    <input className="input-field" placeholder="Subject" value={ticketForm.subject} onChange={(event) => setTicketForm({ ...ticketForm, subject: event.target.value })} />
                    <button type="submit" className="btn-primary w-full">
                      Open ticket
                    </button>
                  </form>
                ) : null}
                {thread?.ticketId ? (
                  <p className="rounded-xl bg-white p-3 text-xs text-emerald-800">Ticket {thread.ticketId} is open. Updates will be emailed.</p>
                ) : null}
                <div ref={bottomRef} />
              </div>
              {live.online ? (
                <form
                  className="flex gap-2 border-t border-gold/30 p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendLive();
                  }}
                >
                  <input
                    className="input-field flex-1"
                    value={liveText}
                    onChange={(event) => setLiveText(event.target.value)}
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
            </>
          ) : (
            <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-warm-cream px-5 py-4" role="log" aria-live="polite">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <p
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                    message.role === "user"
                      ? "rounded-br-md bg-burgundy text-white"
                      : "rounded-bl-md border border-border bg-white text-text-primary"
                  }`}
                >
                  {message.text}
                </p>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <p className="rounded-2xl rounded-bl-md border border-border bg-white px-4 py-2.5 text-sm text-text-muted">
                  {t("chat.typing")}
                </p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border bg-white px-5 py-3">
            {[
              { label: t("chat.quickEvents"), ask: QUICK_QUESTIONS[0] },
              { label: t("chat.quickArticles"), ask: QUICK_QUESTIONS[1] },
              { label: t("chat.quickOrder"), ask: QUICK_QUESTIONS[2] },
              { label: t("chat.quickTrack"), ask: QUICK_QUESTIONS[3] },
            ].map((question) => (
              <button
                key={question.ask}
                type="button"
                onClick={() => handleSend(question.ask)}
                className="rounded-full border border-burgundy/20 bg-burgundy/5 px-3 py-1.5 text-xs font-medium text-burgundy transition hover:bg-burgundy hover:text-white"
              >
                {question.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSend(input);
            }}
            className="flex items-center gap-2 border-t border-border bg-white px-4 py-3"
          >
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("chat.placeholder")}
              aria-label={t("chat.placeholder")}
              className="input-field flex-1 !mb-0"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-burgundy text-white transition hover:bg-burgundy-dark disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
