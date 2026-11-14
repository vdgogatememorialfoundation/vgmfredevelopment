"use client";

import { useEffect, useState } from "react";
import SectionHeader from "@/components/account/SectionHeader";
import { useAuth } from "@/components/auth/AuthContext";
import { addTicket, customerReplyToTicket, ticketsVisibleTo } from "@/lib/admin-store";
import { pullTickets } from "@/lib/ticket-sync";
import { formatDateTime } from "@/lib/utils";
import type { SupportTicket } from "@/types";

const TONE: Record<string, string> = {
  Open: "bg-burgundy/10 text-burgundy",
  "In Progress": "bg-amber-50 text-amber-700",
  Resolved: "bg-emerald-50 text-emerald-700",
  Closed: "bg-warm-cream text-text-muted",
};

export default function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>(() => ticketsVisibleTo(user));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "" });
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");
  const [reply, setReply] = useState("");
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : "Guest";

  const refresh = () => setTickets(ticketsVisibleTo(user));

  useEffect(() => {
    let alive = true;
    const sync = () => void pullTickets().then(() => alive && setTickets(ticketsVisibleTo(user)));
    sync();
    const timer = window.setInterval(sync, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [user]);

  const submit = () => {
    if (!form.subject.trim() || !form.body.trim()) {
      setError("Please add a subject and a message.");
      return;
    }
    addTicket({
      name,
      email: user?.email ?? "",
      phone: user?.phone,
      subject: form.subject,
      body: form.body,
      portal: user?.role === "staff" || user?.role === "coadmin" ? "staff" : "customer",
    });
    setForm({ subject: "", body: "" });
    setShowForm(false);
    refresh();
  };

  const sendReply = (ticket: SupportTicket) => {
    if (!reply.trim()) return;
    customerReplyToTicket(ticket.id, name, reply);
    setReply("");
    refresh();
  };

  return (
    <div>
      <SectionHeader title="Support Tickets" description="This is the only place to raise a Foundation support ticket. Tap a ticket to read the conversation and reply." />
      <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-primary">
        {showForm ? "Close" : "New ticket"}
      </button>

      {showForm && (
        <div className="mt-5 space-y-4 rounded-2xl border border-border bg-warm-cream/40 p-5">
          <input className="input-field" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <textarea className="input-field resize-y" rows={4} placeholder="How can we help?" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="flex items-center gap-3">
            <button type="button" onClick={submit} className="btn-primary">
              Submit ticket
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {tickets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-muted">
            No support tickets yet. Raise one above and our team will respond here and by email.
          </div>
        ) : (
          tickets.map((ticket) => {
            const open = openId === ticket.id;
            return (
              <div key={ticket.id} className="rounded-2xl border border-border bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(open ? "" : ticket.id);
                    setReply("");
                  }}
                  className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"
                  aria-expanded={open}
                >
                  <div>
                    <p className="font-semibold text-text-primary">
                      <span className="text-burgundy underline-offset-2 hover:underline">#{ticket.id}</span> — {ticket.subject}
                    </p>
                    <p className="text-xs text-text-muted">
                      Created {formatDateTime(ticket.createdAt)} · {ticket.responses.length} {ticket.responses.length === 1 ? "reply" : "replies"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE[ticket.status] ?? ""}`}>{ticket.status}</span>
                </button>
                {open && (
                  <div className="space-y-2 border-t border-border p-4">
                    <Bubble mine from="You" at={ticket.createdAt} text={ticket.body} />
                    {ticket.responses.map((r, index) => {
                      const mine = r.from === name || r.from === ticket.name;
                      return <Bubble key={`${r.at}-${index}`} mine={mine} from={mine ? "You" : r.from} at={r.at} text={r.text} />;
                    })}
                    <div className="pt-2">
                      <textarea className="input-field resize-y" rows={3} placeholder="Write a reply to the Foundation team" value={reply} onChange={(e) => setReply(e.target.value)} />
                      <div className="mt-2 flex items-center gap-3">
                        <button type="button" className="btn-primary" disabled={!reply.trim()} onClick={() => sendReply(ticket)}>
                          Send reply
                        </button>
                        {(ticket.status === "Resolved" || ticket.status === "Closed") && <span className="text-xs text-text-muted">Replying reopens this ticket.</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Bubble({ mine, from, at, text }: { mine: boolean; from: string; at: string; text: string }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl border px-3 py-2 text-sm ${mine ? "border-blue-100 bg-blue-50 text-text-primary" : "border-gold/30 bg-warm-cream text-text-primary"}`}>
        <p className="mb-1 text-[11px] font-semibold text-text-muted">
          {from} · {formatDateTime(at)}
        </p>
        {text}
      </div>
    </div>
  );
}
