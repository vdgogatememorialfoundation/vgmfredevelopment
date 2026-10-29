"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/LanguageProvider";
import { answerQuestion } from "@/lib/chat-knowledge";
import SiteLogo from "@/components/common/SiteLogo";

interface ChatMessage {
  role: "bot" | "user";
  text: string;
}

const QUICK_QUESTIONS = [
  "What is the next seminar?",
  "Latest articles",
  "How can I order a book?",
  "Track my order",
];

export function AIChatbot() {
  const { t, locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      text: t("chat.greeting"),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
  }, [messages, isOpen, isTyping]);

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
            "Apologies, I don't have an answer for that yet. Please try a different question, or contact the foundation directly via the Contact page.",
        },
      ]);
      setIsTyping(false);
    }, 700);
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={t("chat.open")}
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-gold/60 bg-ink text-white shadow-[0_8px_24px_rgba(11,31,58,0.28)] transition hover:border-gold sm:right-6"
        >
          <SiteLogo size={40} className="rounded-full" />
        </button>
      )}

      {isOpen && (
        <div className="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex max-h-[min(40rem,calc(100dvh-4.5rem))] w-[calc(100vw-1.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-gold/40 bg-white shadow-2xl sm:right-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gold/40 bg-ink px-4 py-3.5 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-gold/50 bg-white p-0.5">
                <SiteLogo size={40} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-serif text-sm font-semibold tracking-wide">{t("chat.assistant")}</p>
                <p className="truncate text-[10px] uppercase tracking-[0.14em] text-gold">{t("chat.brand")}</p>
                <p className="text-[11px] text-white/70">{t("chat.replies")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t("chat.close")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
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

          {/* Quick questions */}
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

          {/* Input */}
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
        </div>
      )}
    </>
  );
}