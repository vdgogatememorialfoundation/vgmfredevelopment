"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Panel, TextInput } from "@/components/admin/AdminUI";
import { downloadExcel } from "@/lib/export-file";

type SignupForm = {
  formId: string;
  acknowledgementId: string;
  accountId: string;
  createdAt: string;
  method: "email" | "google";
  salutation: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  country?: string;
  ip: string;
  userAgent: string;
};

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const nameOf = (form: SignupForm) => [form.salutation, form.firstName, form.middleName, form.lastName].filter(Boolean).join(" ");

/** Signup acknowledgement forms: admin-only, one at a time or in bulk. */
export function SignupFormsPanel() {
  const [forms, setForms] = useState<SignupForm[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/admin/signup-forms", { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => {
          if (!alive) return;
          if (data.ok) setForms(data.forms);
          else setError(data.error || "Could not load signup forms.");
        })
        .catch(() => alive && setError("Could not load signup forms."));
    void load();
    const timer = window.setInterval(load, 60000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((form) =>
      [nameOf(form), form.email, form.phone, form.accountId, form.formId, form.acknowledgementId].some((value) => value.toLowerCase().includes(q))
    );
  }, [forms, query]);

  const open = (query: string) => window.open(`/api/admin/signup-forms?format=html&${query}`, "_blank", "noopener");
  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allShown = shown.length > 0 && shown.every((form) => picked.has(form.formId));

  const register = () =>
    downloadExcel(
      `signup-forms-${new Date().toISOString().slice(0, 10)}`,
      "Signup forms",
      ["Form ID", "Acknowledgement ID", "Account ID", "Name", "Email", "Phone", "Country", "Signed up with", "Accepted on (IST)", "IP address", "Device / browser"],
      (picked.size ? shown.filter((form) => picked.has(form.formId)) : shown).map((form) => [
        form.formId,
        form.acknowledgementId,
        form.accountId,
        nameOf(form),
        form.email,
        form.phone,
        form.country || "",
        form.method === "google" ? "Google" : "Email",
        when(form.createdAt),
        form.ip,
        form.userAgent,
      ])
    );

  return (
    <Panel
      title={`Signup acknowledgement forms (${forms.length})`}
      description="Recorded for every new account with a Form ID and Acknowledgement ID. Only admins can download them. Download opens the form ready to print or save as PDF."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <TextInput placeholder="Search name, email, phone, Account / Form / Acknowledgement ID" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <Button variant="outline" disabled={!picked.size} onClick={() => open(`ids=${[...picked].join(",")}`)}>
          Download selected ({picked.size})
        </Button>
        <Button variant="outline" disabled={!forms.length} onClick={() => open("all=1")}>
          Download all
        </Button>
        <Button variant="outline" disabled={!shown.length} onClick={register}>
          Excel register
        </Button>
      </div>
      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
      {shown.length === 0 ? (
        <EmptyState text="No signup forms yet. A form is recorded when a customer creates an account." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-[0.12em] text-text-muted">
                <th className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={allShown}
                    onChange={() => setPicked(allShown ? new Set() : new Set(shown.map((form) => form.formId)))}
                    aria-label="Select all"
                  />
                </th>
                <th className="pr-3">Customer</th>
                <th className="px-3">Form ID</th>
                <th className="px-3">Acknowledgement ID</th>
                <th className="px-3">Accepted</th>
                <th className="px-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((form) => (
                <tr key={form.formId} className="border-b border-border/60">
                  <td className="py-2 pr-2">
                    <input type="checkbox" checked={picked.has(form.formId)} onChange={() => toggle(form.formId)} aria-label={`Select ${form.formId}`} />
                  </td>
                  <td className="pr-3">
                    <span className="font-medium text-text-primary">{nameOf(form)}</span>
                    <span className="block text-xs text-text-muted">{form.email} · {form.phone} · {form.accountId}</span>
                  </td>
                  <td className="px-3 font-mono text-xs">{form.formId}</td>
                  <td className="px-3 font-mono text-xs">{form.acknowledgementId}</td>
                  <td className="px-3 text-xs text-text-muted">{when(form.createdAt)} · {form.method === "google" ? "Google" : "Email"}</td>
                  <td className="px-3 text-right">
                    <Button variant="outline" onClick={() => open(`ids=${form.formId}`)}>Download</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
