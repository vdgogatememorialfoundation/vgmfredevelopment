"use client";

import { useEffect, useRef, useState } from "react";
import { events } from "@/data/events";
import { announcements } from "@/data/content";
import { books } from "@/data/books";
import { addToCart, buildTrackingStages, formatPrice, getOrders } from "@/lib/store";
import { storeConfig } from "@/lib/constants";
import { formatDate, formatDateRange } from "@/lib/utils";
import type { Book, Order } from "@/types";

interface ChatMessage {
  role: "bot" | "user";
  text: string;
}

interface KnowledgeBaseEntry {
  keywords: string[];
  answer: () => string;
}

const QUICK_QUESTIONS = [
  "What is the next seminar?",
  "How do I register for an event?",
  "How do I verify a certificate?",
  "How can I order a book?",
  "Track my order",
];

const knowledgeBase: KnowledgeBaseEntry[] = [
  {
    keywords: ["next", "upcoming", "event", "seminar", "workshop", "happen"],
    answer: () => {
      const upcoming = events.filter(
        (event) => event.registrationStatus !== "Closed"
      );
      if (upcoming.length === 0) {
        return "There are no upcoming events published right now. Please check the Events page for the latest schedule.";
      }
      const next = upcoming[0];
      return `The next event is "${next.name}" on ${formatDateRange(
        next.startDate,
        next.endDate
      )} at ${[next.venue, next.city].filter(Boolean).join(", ")}. See the Events page for full details.`;
    },
  },
  {
    keywords: ["register", "registration", "fee", "book", "seat", "attend"],
    answer: () =>
      "To register for an event, visit the event detail page and click 'Register for this event', or create an account and register from the Events page. Registration verifies your email and WhatsApp before completion.",
  },
  {
    keywords: ["certificate", "verify", "verification"],
    answer: () =>
      "Certificates can be verified on the Certificate Verification page by entering the 12-character certificate number found on the certificate, or by scanning its QR code.",
  },
  {
    keywords: ["support", "donate", "contribute", "donation", "help"],
    answer: () =>
      "Thank you for your support. You can contribute through the Donate section on the homepage, sponsor an event, or volunteer your expertise. Contact us for details.",
  },
  {
    keywords: ["account", "login", "register", "create"],
    answer: () =>
      "Create a foundation account from the Login page — it takes less than a minute. Your 12-digit Account ID ties together your registrations, tickets, certificates and orders.",
  },
  {
    keywords: ["book", "store", "purchase", "publication", "buy"],
    answer: () =>
      "The Foundation publishes Ayurveda texts for students and practitioners. Browse the Books page to explore titles, or simply tell me the name of a book here in chat and I can add it straight to your cart. Checkout is handled on our secure checkout page.",
  },
  {
    keywords: ["clinic", "opd", "consultation", "hospital", "treatment"],
    answer: () =>
      "The Foundation runs charitable clinic services on specific days. See the Clinics page for the latest clinic schedule and services.",
  },
  {
    keywords: ["who", "founders", "trustees", "about", "history", "legacy", "rb gogate", "vaidya"],
    answer: () =>
      "The Vaidya Gogate Memorial Foundation preserves the legacy of Vaidya Ramchandra Balaji Gogate, a renowned Ayurveda physician and educator. Founded by his disciples and family, the Foundation advances Ayurveda through education, research and service. Learn more on the About page.",
  },
  {
    keywords: ["notice", "announcement", "news", "update"],
    answer: () => {
      if (announcements.length === 0) {
        return "There are no announcements right now.";
      }
      const latest = announcements[0];
      return `Latest announcement: "${latest.title}". See the Announcements page for the full list.`;
    },
  },
  {
    keywords: ["contact", "email", "phone", "reach", "address"],
    answer: () =>
      "You can reach the Foundation through the Contact page, or write to us at our registered address. A team member typically responds within 2-3 working days.",
  },
];

function findBestAnswer(question: string): string | null {
  const normalized = question.toLowerCase().trim();

  let best: { score: number; entry: KnowledgeBaseEntry } | null = null;

  for (const entry of knowledgeBase) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (normalized.includes(keyword)) score += keyword.length;
    }
    if (score > 0 && (best === null || score > best.score)) {
      best = { score, entry };
    }
  }

  return best ? best.entry.answer() : null;
}

/* ---------- Order intents ---------- */

const ORDER_ID_PATTERN = /\b\d{10,14}\b/g;

function findOrderForQuestion(question: string): Order | null {
  const candidates = question.match(ORDER_ID_PATTERN);
  if (!candidates) return null;
  for (const candidate of candidates) {
    const found = getOrders().find((order) => order.id === candidate);
    if (found) return found;
  }
  return null;
}

function formatOrderStatus(order: Order): string {
  const { stages } = buildTrackingStages(order);
  let reachedLabel = "";
  for (const stage of [...stages].reverse()) {
    if (stage.reached) {
      reachedLabel = stage.label;
      break;
    }
  }

  const courier = order.courierName ?? storeConfig.courierName;
  const tracking = order.trackingId;
  const eta = order.eta ?? "within 3–5 business days";
  const courierLine =
    order.status === "Shipped" ||
    order.status === "Out for Delivery" ||
    order.status === "Delivered"
      ? ` Courier: ${courier}${tracking ? ` · Tracking id ${tracking}` : ""}.`
      : "";

  const done =
    order.status === "Delivered"
      ? `Order ${order.id} was delivered (placed ${formatDate(order.date)}).`
      : `Order ${order.id} placed on ${formatDate(order.date)} is at the “${reachedLabel || order.status}” stage (${order.status}).`;

  return `${done}${courierLine} Estimated delivery: ${eta}. You can tap the order card in My Orders for the full journey — delivery agent OTP shows when out for delivery.`;
}

const STOP_TOKENS = new Set([
  "order", "orders", "book", "books", "buy", "purchase", "want", "need",
  "please", "with", "cart", "basket", "add", "a", "an", "the", "and", "from",
  "for", "delivery", "shipping", "copy", "get", "grab", "i", "me", "to", "of",
  "on", "at", "like", "that", "this",
]);

function findBooksForQuestion(question: string): Book[] {
  const tokens = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP_TOKENS.has(token));
  if (tokens.length === 0) return [];

  const scored = books
    .map((book) => {
      const title = book.title.toLowerCase();
      const score = tokens.reduce(
        (sum, token) => (title.includes(token) ? sum + token.length : sum),
        0
      );
      return { book, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((entry) => entry.book).slice(0, 3);
}

const TRACKING_INTENT =
  /\btrack\b|status|where is (my )?order|my order|deliver|delivery update|shipped|courier|arrive|otp|dispatched/i;

const ORDERING_INTENT =
  /(^|\b)(order|buy|purchase|subscribe)(\b|$)|add.{0,15}(cart|basket)|want.{0,15}(book|publication|copy)|(grab|get).{0,15}(book|copy)/i;

function answerQuestion(question: string): string {
  const hasOrderId = ORDER_ID_PATTERN.test(question);

  // 1. Order status tracking
  if (TRACKING_INTENT.test(question) || hasOrderId) {
    const order = findOrderForQuestion(question);
    if (order) return formatOrderStatus(order);
    if (hasOrderId) {
      return "I couldn't find an order with that ID. Double-check it against your confirmation, or open My Orders — every order you place appears there.";
    }
    return "Happy to help! Please share your 12-digit Order ID (found in your confirmation or on My Orders) and I'll fetch its live status right here.";
  }

  // 2. Ordering a book from chat
  if (ORDERING_INTENT.test(question)) {
    const matches = findBooksForQuestion(question);
    if (matches.length === 1) {
      addToCart(matches[0].id, 1);
      return `I've added “${matches[0].title}” (${formatPrice(matches[0].price)}) to your cart. Open the Cart to review and check out securely — Want anything else?`;
    }
    if (matches.length > 1) {
      return `I found a few titles — which one would you like? ${matches
        .map((book) => `“${book.title}”`)
        .join(", ")}. Just type the name and I'll add it to your cart.`;
    }
    if (/\b(how|could|can i|way|tell)\b/i.test(question)) {
      return "Just tell me the name of a book and I'll add it to your cart — for example “Add Ayurveda Clinical Practice Guidelines to my cart”. Or browse the full range on the Books page.";
    }
    return "I couldn't match that to one of our publications. Browse the range on the Books page, or type the exact title and I'll pop it into your cart.";
  }

  return (
    findBestAnswer(question) ??
    "Apologies, I don't have an answer for that yet. Please try a different question, or contact the foundation directly via the Contact page."
  );
}

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      text: "Namaste! I'm the VGMF Assistant. Ask me about events, registration, certificates, books, clinics or the foundation — and I can add publications to your cart or fetch your order status when you share the 12-digit Order ID.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
          aria-label="Open chat assistant"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-burgundy text-white shadow-lg transition hover:bg-burgundy-dark"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-burgundy px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
                VGMF
              </div>
              <div>
                <p className="text-sm font-semibold">VGMF Assistant</p>
                <p className="text-xs text-white/70">Typically replies instantly</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat assistant"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="max-h-80 flex-1 space-y-4 overflow-y-auto bg-warm-cream px-5 py-4" role="log" aria-live="polite">
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
                  Typing…
                </p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick questions */}
          <div className="flex flex-wrap gap-2 border-t border-border bg-white px-5 py-3">
            {QUICK_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => handleSend(question)}
                className="rounded-full border border-burgundy/20 bg-burgundy/5 px-3 py-1.5 text-xs font-medium text-burgundy transition hover:bg-burgundy hover:text-white"
              >
                {question}
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
              placeholder="Ask the VGMF Assistant…"
              aria-label="Type your message"
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