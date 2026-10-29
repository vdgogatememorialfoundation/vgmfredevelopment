"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { addTicket, getTickets, respondToTicket } from "@/lib/admin-store";
import { formatDateTime } from "@/lib/utils";
import type { SupportTicket } from "@/types";

function snapshot() {
  return window.localStorage.getItem("vgmf_tickets") ?? "";
}

const TONE: Record<string, string> = {
  Open: "bg-burgundy/10 text-burgundy",
  "In Progress": "bg-amber-50 text-amber-700",
  Resolved: "bg-emerald-50 text-emerald-700",
  Closed: "bg-warm-cream text-text-muted",
};

export default function SupportPage() {
  const { user } = useAuth();
  useSyncExternalStore(
    (onChange) => {
      const handler = () => onChange();
      window.addEventListener("vgmf-cms", handler);
      window.addEventListener("storage", handler);
      return () => {
        window.removeEventListener("vgmf-cms", handler);
        window.removeEventListener("storage", handler);
      };
    },
    snapshot,
    () => ""
  );

  const tickets = getTickets();
  const portal = user?.role === "staff" || user?.role === "admin" ? "staff" : user ? "customer" : "public";
  const mine = useMemo(
    () =>
      user
        ? tickets.filter((ticket) => ticket.email.toLowerCase() === user.email.toLowerCase())
        : [],
    [tickets, user]
  );

  const [form, setForm] = useState({ name: "", email: "", subject: "", body: "" });
  const [error, setError] = useState("");
  const [reply, setReply] = useState<Record<string, string>>({});

  const submit = () => {
    const name = (user ? `${user.firstName} ${user.lastName}`.trim() : form.name).trim();
    const email = (user?.email || form.email).trim();
    if (!name || !email || !form.subject.trim() || !form.body.trim()) {
      setError("Please add your name, email, subject and message.");
      return;
    }
    addTicket({
      name,
      email,
      subject: form.subject,
      body: form.body,
      portal,
    });
    setForm({ name: "", email: "", subject: "", body: "" });
    setError("");
  };

  return (
    <main className="section bg-background">
      <div className="container max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Support</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">Help desk</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">
          Staff, customers and anyone who creates an account can open a ticket here. Replies stay on the ticket thread.
          Live chat can be turned on from the admin console when the team is online.
        </p>
        {!user ? (
          <p className="mt-4 text-sm">
            <Link href="/login" className="font-semibold text-burgundy">
              Sign in
            </Link>{" "}
            or create an account to keep your tickets with you. Guests can still send a request below.
          </p>
        ) : (
          <p className="mt-4 text-sm text-text-muted">
            Signed in as {user.firstName} {user.lastName} ({user.role || "customer"}).
          </p>
        )}

        <form
          className="mt-8 space-y-4 rounded-2xl border border-border bg-white p-6"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {!user ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                className="input-field"
                placeholder="Your name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <input
                className="input-field"
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
          ) : null}
          <input
            className="input-field"
            placeholder="Subject"
            value={form.subject}
            onChange={(event) => setForm({ ...form, subject: event.target.value })}
          />
          <textarea
            className="input-field resize-y"
            rows={4}
            placeholder="How can we help?"
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
          />
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary">
              Submit ticket
            </button>
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
        </form>

        <div className="mt-10 space-y-3">
          <h2 className="font-serif text-2xl text-ink">Your tickets</h2>
          {mine.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-muted">
              No tickets yet. Submit one above.
            </p>
          ) : (
            mine.map((ticket) => (
              <TicketThread
                key={ticket.id}
                ticket={ticket}
                reply={reply[ticket.id] ?? ""}
                onReplyChange={(value) => setReply((current) => ({ ...current, [ticket.id]: value }))}
                onSend={() => {
                  const text = reply[ticket.id]?.trim();
                  if (!text) return;
                  respondToTicket(ticket.id, nameFor(user), text);
                  setReply((current) => ({ ...current, [ticket.id]: "" }));
                }}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}

function nameFor(user: { firstName?: string; lastName?: string } | null) {
  if (!user) return "Guest";
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Guest";
}

function TicketThread({
  ticket,
  reply,
  onReplyChange,
  onSend,
}: {
  ticket: SupportTicket;
  reply: string;
  onReplyChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-text-primary">
            #{ticket.id} — {ticket.subject}
          </p>
          <p className="text-xs text-text-muted">
            {ticket.portal ?? "support"} · {formatDateTime(ticket.createdAt)}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE[ticket.status] ?? ""}`}>
          {ticket.status}
        </span>
      </div>
      <p className="mt-2 text-sm text-text-primary">{ticket.body}</p>
      {ticket.responses.map((item, index) => (
        <p key={index} className="mt-2 rounded-lg bg-warm-cream p-3 text-xs text-text-muted">
          <span className="font-semibold text-text-primary">{item.from}</span>
          {" · "}
          {formatDateTime(item.at)}
          <br />
          {item.text}
        </p>
      ))}
      {ticket.status !== "Closed" ? (
        <div className="mt-3 flex gap-2">
          <input
            className="input-field flex-1"
            value={reply}
            onChange={(event) => onReplyChange(event.target.value)}
            placeholder="Add a reply"
          />
          <button type="button" className="rounded-lg bg-burgundy px-3 py-2 text-sm font-semibold text-white" onClick={onSend}>
            Send
          </button>
        </div>
      ) : null}
    </article>
  );
}
