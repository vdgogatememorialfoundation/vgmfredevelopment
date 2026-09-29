"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { getModule } from "@/lib/cms/modules";
import FieldInput, { toFormValue, type FormValue } from "@/components/portal/FieldInput";
import { api } from "@/components/portal/api";

export default function SettingsForm({ moduleKey }: { moduleKey: string }) {
  const mod = getModule(moduleKey);
  const [values, setValues] = useState<Record<string, FormValue> | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mod) return;
    api<{ value: Record<string, unknown> }>(`/api/admin/settings/${moduleKey}`)
      .then((res) => {
        const next: Record<string, FormValue> = {};
        for (const field of mod.fields) next[field.name] = toFormValue(field, res.value[field.name]);
        setValues(next);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load settings."));
  }, [mod, moduleKey]);

  if (!mod) return <p className="text-sm text-red-600">Unknown settings page.</p>;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api(`/api/admin/settings/${moduleKey}`, { method: "PUT", json: { value: values } });
      setMessage("Settings saved. The website updates within a few seconds.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">Settings</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-text-primary">{mod.label}</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">{mod.description}</p>
        </div>
        {mod.sitePath && (
          <a href={mod.sitePath} target="_blank" rel="noreferrer" className="btn-outline px-4 py-2 text-sm"><ExternalLink size={15} /> View on website</a>
        )}
      </div>
      {message && <div className="rounded-xl border border-sage/30 bg-sage-light px-4 py-2.5 text-sm font-medium text-sage">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        {!values ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {mod.fields.map((field) => (
                <FieldInput key={field.name} field={field} value={values[field.name] ?? ""} onChange={(v) => setValues({ ...values, [field.name]: v })} />
              ))}
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <button type="button" disabled={saving} onClick={save} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">{saving ? "Saving…" : "Save settings"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
