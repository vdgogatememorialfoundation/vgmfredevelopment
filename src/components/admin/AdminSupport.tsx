"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  deleteFaq,
  getFaqs,
  getOutbox,
  getSupportMessages,
  getTickets,
  replyToQuery,
  respondToTicket,
  sendAbandonedCartEmail,
  triggerOutOfStockEmails,
  updateTicketStatus,
  saveFaq,
} from "@/lib/admin-store";
import {
  getChatThreads,
  getLiveChatSettings,
  postChatMessage,
  saveLiveChatSettings,
  subscribeLiveChat,
} from "@/lib/live-chat";
import type { FAQItem, SupportTicket } from "@/types";
import {
  Button,
  EmptyState,
  Field,
  Panel,
  SelectInput,
  StatusBadge,
  TextArea,
  TextInput,
} from "@/components/admin/AdminUI";
import { classNames, formatDateTime } from "@/lib/utils";

const TICKET_TONES: Record<string, string> = {
  Open: "bg-burgundy/10 text-burgundy",
  "In Progress": "bg-amber-50 text-amber-700",
  Resolved: "bg-emerald-50 text-emerald-700",
  Closed: "bg-warm-cream text-text-muted",
};

export function SupportSection() {
  const [tab, setTab] = useState<"queries" | "tickets" | "chat" | "faq">("tickets");
  const [messages, setMessages] = useState(() => getSupportMessages());
  const [tickets, setTickets] = useState(() => getTickets());
  const [faqs, setFaqs] = useState(() => getFaqs());
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const refresh = () => {
    setMessages(getSupportMessages());
    setTickets(getTickets());
    setFaqs(getFaqs());
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Support</h1>
        <p className="text-sm text-text-muted">
          Tickets from the public support portal, staff and customers — including every reply. Enable live chat when the team is online.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href="/support" className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-burgundy">Support portal</Link>
          <Link href="/account" className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-burgundy">Customer portal</Link>
          <Link href="/staff" className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-burgundy">Staff portal</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["tickets", "chat", "queries", "faq"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={classNames(
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              tab === t ? "bg-burgundy text-white" : "bg-white text-text-muted hover:text-burgundy border border-border"
            )}
          >
            {t === "queries" ? "Contact queries" : t === "tickets" ? "Tickets" : t === "chat" ? "Live chat" : "FAQ"}
          </button>
        ))}
      </div>

      {tab === "queries" && (
        <Panel title={`Contact queries (${messages.length})`} description="Replies are emailed to the customer.">
          {messages.length === 0 ? (
            <EmptyState text="No contact queries yet." />
          ) : (
            <ul className="space-y-3">
              {messages.map((m) => (
                <li key={m.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-text-primary">{m.subject}</p>
                    <StatusBadge status={m.status} mapping={{ New: "bg-amber-50 text-amber-700", Replied: "bg-emerald-50 text-emerald-700" }} />
                  </div>
                  <p className="text-xs text-text-muted">
                    {m.name} · {m.email} · {formatDateTime(m.receivedAt)}
                  </p>
                  <p className="mt-2 text-sm text-text-primary">{m.message}</p>

                  {m.reply && (
                    <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                      Reply sent: {m.reply}
                    </p>
                  )}

                  {replyingId === m.id ? (
                    <div className="mt-3 space-y-2">
                      <TextArea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply — sent via email" />
                      <div className="flex gap-2">
                        <Button onClick={() => { replyToQuery(m.id, reply); setReplyingId(null); setReply(""); refresh(); }}>Send reply</Button>
                        <Button variant="outline" onClick={() => setReplyingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    m.status === "New" && (
                      <div className="mt-3">
                        <Button variant="outline" onClick={() => setReplyingId(m.id)}>Reply</Button>
                      </div>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === "tickets" && (
        <Panel title={`Support tickets (${tickets.length})`} description="Every ticket from /support, customer accounts and staff, with the full reply thread.">
          {tickets.length === 0 ? (
            <EmptyState text="No tickets yet. Visitors raise them from /support or the account area." />
          ) : (
            <ul className="space-y-3">
              {tickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} onChanged={refresh} />
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === "chat" && <LiveChatDesk />}

      {tab === "faq" && (
        <Panel title={`FAQ (${faqs.length})`} description="SPAs answer these in the chatbot and FAQ pages.">
          <FaqManager />
        </Panel>
      )}
    </div>
  );
}

function TicketCard({ ticket, onChanged }: { ticket: SupportTicket; onChanged: () => void }) {
  const [response, setResponse] = useState("");
  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-text-primary">#{ticket.id} — {ticket.subject}</p>
          <p className="text-xs text-text-muted">{ticket.name} · {ticket.email} · {ticket.portal ?? "customer"} · {formatDateTime(ticket.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={ticket.status} mapping={TICKET_TONES} />
          <SelectInput className="w-32" value={ticket.status} onChange={(e) => { updateTicketStatus(ticket.id, e.target.value as SupportTicket["status"]); onChanged(); }}>
            {["Open", "In Progress", "Resolved", "Closed"].map((s) => <option key={s}>{s}</option>)}
          </SelectInput>
        </div>
      </div>
      <p className="mt-2 text-sm text-text-primary">{ticket.body}</p>
      {ticket.responses.length > 0 && (
        <div className="mt-3 space-y-2">
          {ticket.responses.map((r, index) => (
            <p key={index} className="rounded-lg bg-warm-cream p-2.5 text-xs text-text-muted">
              <span className="font-semibold text-text-primary">{r.from}</span> · {formatDateTime(r.at)}<br />
              {r.text}
            </p>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <TextInput value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Add a response (emailed to customer)" className="flex-1" />
        <Button onClick={() => { respondToTicket(ticket.id, "VGMF Support", response); setResponse(""); onChanged(); }}>Send</Button>
      </div>
    </li>
  );
}

function chatSnapshot() {
  return `${window.localStorage.getItem("vgmf_live_chat_settings") ?? ""}|${window.localStorage.getItem("vgmf_live_chat_threads") ?? ""}`;
}

export function LiveChatDesk() {
  useSyncExternalStore(subscribeLiveChat, chatSnapshot, () => "");
  const settings = getLiveChatSettings();
  const threads = getChatThreads();
  const [activeId, setActiveId] = useState(threads[0]?.id ?? "");
  const [reply, setReply] = useState("");
  const active = threads.find((thread) => thread.id === activeId) ?? threads[0];

  return (
    <div className="space-y-4">
      <Panel title="Live chat" description="Enable the widget on the public site. Switch online when staff can reply.">
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => saveLiveChatSettings({ ...settings, enabled: event.target.checked })}
            />
            Enable live chat
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.online}
              onChange={(event) => saveLiveChatSettings({ ...settings, enabled: true, online: event.target.checked })}
            />
            Staff are online
          </label>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          When chat is enabled but offline, visitors are asked to open a ticket on /support.
        </p>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <ul className="space-y-2">
          {threads.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border p-4 text-sm text-text-muted">No chats yet.</li>
          ) : (
            threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(thread.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${active?.id === thread.id ? "border-burgundy bg-burgundy/5" : "border-border bg-white"}`}
                >
                  <span className="font-semibold text-text-primary">{thread.name}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">{thread.page || "site"} · {thread.messages.length} messages</span>
                </button>
              </li>
            ))
          )}
        </ul>
        {active ? (
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="font-semibold text-text-primary">{active.name}</p>
            <p className="text-xs text-text-muted">{active.email || "no email"} · {active.page}</p>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {active.messages.map((message) => (
                <p key={message.id} className={`rounded-lg p-2 text-sm ${message.from === "staff" ? "bg-emerald-50" : "bg-warm-cream"}`}>
                  <span className="text-xs font-semibold">{message.name}</span>
                  <br />
                  {message.text}
                </p>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <TextInput value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply as VGMF Support" className="flex-1" />
              <Button
                onClick={() => {
                  postChatMessage({ threadId: active.id, from: "staff", name: "VGMF Support", text: reply });
                  setReply("");
                }}
              >
                Send
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FaqManager() {
  const [faqs, setFaqs] = useState<FAQItem[]>(() => getFaqs());
  const [form, setForm] = useState<FAQItem>({ id: "", question: "", answer: "", category: "General", active: true });
  const refresh = () => setFaqs(getFaqs());

  const save = () => {
    saveFaq({ ...form, id: form.id || `faq-${Date.now()}` });
    refresh();
    setForm({ id: "", question: "", answer: "", category: "General", active: true });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border p-4">
        <Field label="Question"><TextInput value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></Field>
        <Field label="Answer"><TextArea rows={2} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} /></Field>
        <div className="flex gap-2">
          <Button onClick={save}>{form.id ? "Update FAQ" : "Add FAQ"}</Button>
        </div>
      </div>
      {faqs.length === 0 ? (
        <EmptyState text="No FAQs yet." />
      ) : (
        <ul className="space-y-2">
          {faqs.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 text-sm">
              <div>
                <p className="font-semibold text-text-primary">{f.question}</p>
                <p className="mt-0.5 text-xs text-text-muted">{f.answer}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" onClick={() => setForm(f)}>Edit</Button>
                <Button variant="danger" onClick={() => { deleteFaq(f.id); refresh(); }}>Del</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EmailSection() {
  const [outbox, setOutbox] = useState(() => getOutbox());
  const [abandon, setAbandon] = useState({ email: "", items: "" });
  const [note, setNote] = useState("");
  const refresh = () => setOutbox(getOutbox());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Mail & Notifications</h1>
        <p className="text-sm text-text-muted">
          Transactional emails are sent via ZeptoMail (simulated) and logged here.
        </p>
      </div>

      <Panel title="Triggers">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Field label="Abandoned cart email">
              <TextInput value={abandon.email} onChange={(e) => setAbandon({ ...abandon, email: e.target.value })} placeholder="customer@example.com" />
            </Field>
            <Field label="Items (comma separated)">
              <TextInput value={abandon.items} onChange={(e) => setAbandon({ ...abandon, items: e.target.value })} placeholder="Book A, Book B" />
            </Field>
            <div className="mt-2">
              <Button onClick={() => { sendAbandonedCartEmail(abandon.email, abandon.items.split(",").map((i) => i.trim())); refresh(); }}>Send</Button>
            </div>
          </div>
          <div className="flex flex-col items-start justify-end gap-2">
            <Button variant="outline" onClick={() => { const n = triggerOutOfStockEmails(); setNote(`Sent out-of-stock alerts for ${n} products.`); refresh(); }}>
              Send out-of-stock alerts
            </Button>
            {note && <p className="text-xs text-text-muted">{note}</p>}
          </div>
        </div>
      </Panel>

      <Panel title={`Outbox (${outbox.length})`} description="Emails dispatched through ZeptoMail (records persist in-session/demo storage).">
        {outbox.length === 0 ? (
          <EmptyState text="No emails sent yet." />
        ) : (
          <ul className="space-y-2">
            {outbox.map((mail) => (
              <li key={mail.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-text-primary">To: {mail.to}</p>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{mail.status}</span>
                </div>
                <p className="mt-1 text-text-primary">{mail.subject}</p>
                <p className="mt-1 whitespace-pre-line text-xs text-text-muted">{mail.body}</p>
                <p className="mt-1 text-[11px] text-text-muted">{mail.template} · {formatDateTime(mail.sentAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}