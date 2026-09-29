"use client";

import { useState } from "react";
import SectionHeader from "@/components/account/SectionHeader";
import { useAuth } from "@/components/auth/AuthContext";
import { addTicket, getTickets } from "@/lib/admin-store";
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
  const [tickets, setTickets] = useState<SupportTicket[]>(() => getTickets());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "" });
  const [error, setError] = useState("");

  const refresh = () => setTickets(getTickets());

  const submit = () => {
    if (!form.subject.trim() || !form.body.trim()) {
      setError("Please add a subject and a message.");
      return;
    }
    addTicket({
      name: user ? `${user.firstName} ${user.lastName}`.trim() : "Guest",
      email: user?.email ?? "",
      subject: form.subject,
      body: form.body,
    });
    setForm({ subject: "", body: "" });
    setShowForm(false);
    refresh();
  };

  const mine = tickets.filter((t) => (user ? t.email === user.email : true));

  return (
    <div>
      <SectionHeader
        title="Support Tickets"
        description="Raise a support request and track the Foundation team's response."
      />
      <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-primary">
        {showForm ? "Close" : "New ticket"}
      </button>

      {showForm && (
        <div className="mt-5 space-y-4 rounded-2xl border border-border bg-warm-cream/40 p-5">
          <input
            className="input-field"
            placeholder="Subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <textarea
            className="input-field resize-y"
            rows={4}
            placeholder="How can we help?"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <div className="flex items-center gap-3">
            <button type="button" onClick={submit} className="btn-primary">Submit ticket</button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {mine.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-muted">
            No support tickets yet. Raise one above and our team will respond
            here and by email.
          </div>
        ) : (
          mine.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-text-primary">
                    #{ticket.id} — {ticket.subject}
                  </p>
                  <p className="text-xs text-text-muted">
                    Created {formatDateTime(ticket.createdAt)}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE[ticket.status] ?? ""}`}>
                  {ticket.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-text-primary">{ticket.body}</p>
              {ticket.responses.map((r, index) => (
                <p key={index} className="mt-2 rounded-lg bg-warm-cream p-3 text-xs text-text-muted">
                  <span className="font-semibold text-text-primary">{r.from}</span>
                  {" · "}
                  {formatDateTime(r.at)}
                  <br />
                  {r.text}
                </p>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}