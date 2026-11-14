"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, Field, Panel, SelectInput, TextArea, TextInput, formatINR } from "@/components/admin/AdminUI";
import { ImageField } from "@/components/admin/ImageField";

type Line = { title: string; quantity: number; price: number; batchNo?: string };
type Invoice = {
  key: string;
  number: string;
  issuedAt: string;
  kind: "order" | "platform-fee" | "custom";
  orderId?: string;
  title: string;
  customer: string;
  email: string;
  total: number;
  emailedTo?: string;
  emailedAt?: string;
  to?: { name?: string; address?: string; phone?: string; email?: string };
  lines?: Line[];
  shipping?: number;
  discount?: number;
  courier?: string;
  transport?: string;
  awb?: string;
  notes?: string;
};
type Settings = { enabled: boolean; separatePlatformFee: boolean; signatureUrl: string; signatoryName: string };
type Draft = {
  name: string;
  address: string;
  phone: string;
  email: string;
  lines: string;
  shipping: string;
  discount: string;
  courier: string;
  transport: string;
  awb: string;
  notes: string;
};

const blankDraft: Draft = { name: "", address: "", phone: "", email: "", lines: "", shipping: "", discount: "", courier: "", transport: "", awb: "", notes: "" };

async function api<T>(body?: Record<string, unknown>) {
  const response = await fetch("/api/admin/invoices", body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

const linesText = (lines: Line[] = []) => lines.map((line) => `${line.title} | ${line.quantity} | ${line.price}`).join("\n");

function parseLines(text: string): Line[] {
  return text
    .split("\n")
    .map((row) => row.split("|").map((part) => part.trim()))
    .filter(([title]) => title)
    .map(([title, quantity, price]) => ({ title, quantity: Number(quantity) || 1, price: Number(price) || 0 }));
}

function fromDraft(draft: Draft) {
  return {
    to: { name: draft.name, address: draft.address, phone: draft.phone, email: draft.email },
    lines: parseLines(draft.lines),
    shipping: draft.shipping,
    discount: draft.discount,
    courier: draft.courier,
    transport: draft.transport,
    awb: draft.awb,
    notes: draft.notes,
  };
}

function toDraft(invoice: Invoice): Draft {
  return {
    name: invoice.to?.name ?? "",
    address: invoice.to?.address ?? "",
    phone: invoice.to?.phone ?? "",
    email: invoice.to?.email ?? "",
    lines: linesText(invoice.lines),
    shipping: invoice.shipping === undefined ? "" : String(invoice.shipping),
    discount: invoice.discount === undefined ? "" : String(invoice.discount),
    courier: invoice.courier ?? "",
    transport: invoice.transport ?? "",
    awb: invoice.awb ?? "",
    notes: invoice.notes ?? "",
  };
}

function DraftFields({ draft, setDraft, fromOrder }: { draft: Draft; setDraft: (draft: Draft) => void; fromOrder: boolean }) {
  const hint = fromOrder ? "Leave blank to use the order" : undefined;
  const text = (key: keyof Draft, label: string, help = hint) => (
    <Field label={help ? `${label} (${help.toLowerCase()})` : label}>
      <TextInput value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
    </Field>
  );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {text("name", "Bill to: name")}
      {text("phone", "Phone")}
      {text("email", "Email")}
      {text("address", "Address")}
      {text("courier", "Shipped by courier")}
      {text("transport", "Mode of transport", fromOrder ? "Blank = from shipment, e.g. Road (courier surface)" : "e.g. Road, Air, Hand delivery")}
      {text("awb", "AWB no.")}
      {text("shipping", "Shipping (₹)")}
      {text("discount", "Discount (₹)")}
      <div className="md:col-span-2">
        <Field label={`Items, one per line: name | qty | rate${hint ? ` (${hint.toLowerCase()})` : ""}`}>
          <TextArea rows={4} value={draft.lines} onChange={(event) => setDraft({ ...draft, lines: event.target.value })} />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Note printed on the invoice">
          <TextArea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </Field>
      </div>
    </div>
  );
}

export function InvoicesDesk() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [createKind, setCreateKind] = useState<Invoice["kind"]>("order");
  const [createOrder, setCreateOrder] = useState("");
  const [createDraft, setCreateDraft] = useState<Draft>(blankDraft);
  const [editing, setEditing] = useState<{ key: string; draft: Draft; fromOrder: boolean } | null>(null);

  const load = useCallback(async () => {
    const data = await api<{ invoices: Invoice[]; settings: Settings }>();
    setInvoices(data.invoices);
    setSettings(data.settings);
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load().catch((error: Error) => setMessage(error.message)), 0);
    const timer = window.setInterval(() => void load().catch(() => undefined), 30000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  const run = async (label: string, task: () => Promise<string | void>) => {
    setBusy(label);
    setMessage("");
    try {
      const text = await task();
      await load();
      if (text) setMessage(text);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy("");
    }
  };

  const saveSettings = (next: Settings) => {
    setSettings(next);
    void run("settings", async () => {
      await api({ action: "settings", settings: next });
      return "Invoice settings saved.";
    });
  };

  const needle = query.trim().toLowerCase();
  const shown = invoices.filter((invoice) => !needle || [invoice.number, invoice.orderId, invoice.customer, invoice.email].some((value) => String(value ?? "").toLowerCase().includes(needle)));

  return (
    <div className="space-y-6">
      {message ? <p className="rounded-lg bg-warm-cream p-3 text-sm">{message}</p> : null}
      {settings ? (
        <Panel title="Invoice settings" description="Invoices are plain invoices (no GST). When automatic invoices are off, nothing is sent after delivery, but you can still create any invoice below.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.enabled} onChange={(event) => saveSettings({ ...settings, enabled: event.target.checked })} />
              Issue and email the invoice automatically when an order is delivered
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.separatePlatformFee} onChange={(event) => saveSettings({ ...settings, separatePlatformFee: event.target.checked })} />
              Bill the platform fee on a separate invoice
            </label>
            <ImageField label="Signature (printed on every invoice)" value={settings.signatureUrl} onChange={(signatureUrl) => saveSettings({ ...settings, signatureUrl })} hint="PNG with a transparent or white background works best" />
            <Field label="Signatory name / designation">
              <TextInput value={settings.signatoryName} onChange={(event) => setSettings({ ...settings, signatoryName: event.target.value })} onBlur={() => saveSettings(settings)} />
            </Field>
          </div>
        </Panel>
      ) : null}

      <Panel title="Create an invoice" description="From an order (items, address, courier and AWB are filled in from the order), a platform-fee invoice for an order, or a custom invoice.">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <SelectInput value={createKind} onChange={(event) => setCreateKind(event.target.value as Invoice["kind"])}>
              <option value="order">Order invoice</option>
              <option value="platform-fee">Platform fee invoice</option>
              <option value="custom">Custom invoice</option>
            </SelectInput>
            {createKind !== "custom" ? <TextInput placeholder="Order ID" value={createOrder} onChange={(event) => setCreateOrder(event.target.value)} /> : null}
          </div>
          <DraftFields draft={createDraft} setDraft={setCreateDraft} fromOrder={createKind !== "custom"} />
          <Button
            disabled={busy === "create"}
            onClick={() =>
              run("create", async () => {
                const { invoice } = await api<{ invoice: Invoice }>({ action: "create", kind: createKind, orderId: createOrder, invoice: fromDraft(createDraft) });
                setCreateDraft(blankDraft);
                setCreateOrder("");
                return `Invoice ${invoice.number} created.`;
              })
            }
          >
            {busy === "create" ? "Creating…" : "Create invoice"}
          </Button>
        </div>
      </Panel>

      <Panel title={`Invoices (${invoices.length})`} action={<TextInput placeholder="Search number, order, customer" value={query} onChange={(event) => setQuery(event.target.value)} />}>
        {shown.length === 0 ? (
          <EmptyState text="No invoices yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="p-2">Invoice</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Order</th>
                  <th className="p-2">Customer</th>
                  <th className="p-2 text-right">Total</th>
                  <th className="p-2">Emailed</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((invoice) => (
                  <tr key={invoice.key} className="border-t border-border align-top">
                    <td className="p-2">
                      <b>{invoice.number}</b>
                      <div className="text-xs text-text-muted">{new Date(invoice.issuedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</div>
                    </td>
                    <td className="p-2">{invoice.title}</td>
                    <td className="p-2">{invoice.orderId || "—"}</td>
                    <td className="p-2">
                      {invoice.customer}
                      <div className="text-xs text-text-muted">{invoice.email}</div>
                    </td>
                    <td className="p-2 text-right">{formatINR(invoice.total)}</td>
                    <td className="p-2 text-xs">{invoice.emailedAt ? `${invoice.emailedTo} · ${new Date(invoice.emailedAt).toLocaleDateString("en-IN")}` : invoice.emailedTo || "—"}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2">
                        <a className="text-burgundy underline" href={`/api/admin/invoices?view=${encodeURIComponent(invoice.key)}`} target="_blank" rel="noreferrer">
                          View / print
                        </a>
                        <Button variant="outline" onClick={() => setEditing({ key: invoice.key, draft: toDraft(invoice), fromOrder: invoice.kind !== "custom" })}>Edit</Button>
                        <Button
                          variant="outline"
                          disabled={busy === `mail-${invoice.key}`}
                          onClick={() =>
                            run(`mail-${invoice.key}`, async () => {
                              const to = window.prompt("Send the invoice to", invoice.email || "");
                              if (to === null) return;
                              const { invoice: sent } = await api<{ invoice: Invoice }>({ action: "email", key: invoice.key, to });
                              return `Invoice ${sent.number} emailed to ${sent.emailedTo}.`;
                            })
                          }
                        >
                          {busy === `mail-${invoice.key}` ? "Sending…" : "Email"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            window.confirm(`Delete invoice ${invoice.number}?`) &&
                            run(`del-${invoice.key}`, async () => {
                              await api({ action: "delete", key: invoice.key });
                              return `Invoice ${invoice.number} deleted.`;
                            })
                          }
                        >
                          Delete
                        </Button>
                      </div>
                      {editing?.key === invoice.key ? (
                        <div className="mt-3 space-y-3 rounded-lg border border-border p-3">
                          <DraftFields draft={editing.draft} setDraft={(draft) => setEditing({ ...editing, draft })} fromOrder={editing.fromOrder} />
                          <div className="flex gap-2">
                            <Button
                              onClick={() =>
                                run(`save-${invoice.key}`, async () => {
                                  await api({ action: "update", key: invoice.key, invoice: fromDraft(editing.draft) });
                                  setEditing(null);
                                  return `Invoice ${invoice.number} updated.`;
                                })
                              }
                            >
                              Save invoice
                            </Button>
                            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
