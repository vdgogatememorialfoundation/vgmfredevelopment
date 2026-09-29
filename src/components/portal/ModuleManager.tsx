"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { getModule, type ModuleDef } from "@/lib/cms/modules";
import FieldInput, { toFormValue, type FormValue } from "@/components/portal/FieldInput";
import { api, downloadCsv, StatusPill } from "@/components/portal/api";

interface Item {
  id: string;
  data: Record<string, unknown>;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface Draft {
  id?: string;
  values: Record<string, FormValue>;
  status: string;
  sortOrder: string;
}

function emptyDraft(mod: ModuleDef): Draft {
  const values: Record<string, FormValue> = {};
  for (const field of mod.fields) values[field.name] = field.type === "boolean" ? false : "";
  if (mod.filter?.field && mod.filter.value) values[mod.filter.field] = mod.filter.value;
  return { values, status: mod.filter?.status ?? mod.statuses?.[0] ?? "published", sortOrder: "0" };
}

function display(value: unknown, type?: string) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : "—";
  if (type === "number" && typeof value === "number") return value.toLocaleString("en-IN");
  if (typeof value === "object") return "…";
  return String(value);
}

export default function ModuleManager({ moduleKey, create }: { moduleKey: string; create?: boolean }) {
  const mod = getModule(moduleKey);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(() => (mod && (create || mod.startInCreate) ? emptyDraft(mod) : null));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ items: Item[] }>(`/api/admin/modules/${moduleKey}`);
      setItems(res.items);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load records.");
    } finally {
      setLoading(false);
    }
  }, [moduleKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (statusFilter === "all" || item.status === statusFilter) &&
        (!q || JSON.stringify(item.data).toLowerCase().includes(q))
    );
  }, [items, query, statusFilter]);

  if (!mod) return <p className="text-sm text-red-600">Unknown mod “{moduleKey}”.</p>;

  const columns = mod.columns ?? [mod.titleField ?? mod.fields[0].name];
  const fieldType = (name: string) => mod.fields.find((f) => f.name === name)?.type;
  const labelOf = (name: string) => mod.fields.find((f) => f.name === name)?.label ?? name;
  const statuses = mod.statuses ?? ["published", "draft"];
  const counts = statuses.map((s) => ({ status: s, n: items.filter((i) => i.status === s).length }));

  const edit = (item: Item) => {
    const values: Record<string, FormValue> = {};
    for (const field of mod.fields) values[field.name] = toFormValue(field, item.data[field.name]);
    setDraft({ id: item.id, values, status: item.status, sortOrder: String(item.sortOrder) });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const body = { data: draft.values, status: draft.status, sortOrder: Number(draft.sortOrder) || 0 };
      if (draft.id) {
        await api(`/api/admin/modules/${moduleKey}/${draft.id}`, { method: "PATCH", json: body });
        setNotice("Saved. The website updates within a few seconds.");
      } else {
        await api(`/api/admin/modules/${moduleKey}`, { method: "POST", json: body });
        setNotice("Created. The website updates within a few seconds.");
      }
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (item: Item, status: string) => {
    try {
      await api(`/api/admin/modules/${moduleKey}/${item.id}`, { method: "PATCH", json: { status } });
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, status } : i)));
      setNotice(`Status changed to ${status}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status.");
    }
  };

  const remove = async (item: Item) => {
    const title = String(item.data[mod.titleField ?? "title"] ?? "this record");
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/modules/${moduleKey}/${item.id}`, { method: "DELETE" });
      setItems((list) => list.filter((i) => i.id !== item.id));
      setNotice("Deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
    }
  };

  const exportCsv = () => {
    const names = mod.fields.map((f) => f.name);
    downloadCsv(
      `${mod.key}-${new Date().toISOString().slice(0, 10)}.csv`,
      [...names, "status", "createdAt"],
      filtered.map((item) => [...names.map((n) => item.data[n]), item.status, item.createdAt])
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">{mod.group === "website" ? "Website & CMS" : mod.group}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-text-primary">{mod.label}</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">{mod.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mod.sitePath && (
            <a href={mod.sitePath} target="_blank" rel="noreferrer" className="btn-outline px-4 py-2 text-sm">
              <ExternalLink size={15} /> View on website
            </a>
          )}
          <button type="button" onClick={() => setDraft(emptyDraft(mod))} className="btn-primary px-4 py-2 text-sm">
            <Plus size={16} /> {mod.createLabel ?? "Add new"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setStatusFilter("all")} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${statusFilter === "all" ? "border-burgundy bg-burgundy text-white" : "border-border bg-white text-text-muted hover:border-burgundy/40"}`}>
          All · {items.length}
        </button>
        {counts.map(({ status, n }) => (
          <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize transition ${statusFilter === status ? "border-burgundy bg-burgundy text-white" : "border-border bg-white text-text-muted hover:border-burgundy/40"}`}>
            {status} · {n}
          </button>
        ))}
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-sage/30 bg-sage-light px-4 py-2.5 text-sm font-medium text-sage">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      {draft && (
        <div className="rounded-2xl border border-burgundy/20 bg-white p-5 shadow-lg shadow-burgundy/5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-text-primary">{draft.id ? `Edit ${mod.label}` : mod.createLabel ?? `New ${mod.label}`}</h2>
            <button type="button" onClick={() => setDraft(null)} className="rounded-full p-1.5 text-text-muted hover:bg-warm-cream" aria-label="Close editor"><X size={18} /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {mod.fields.map((field) => (
              <FieldInput key={field.name} field={field} value={draft.values[field.name] ?? ""} onChange={(v) => setDraft({ ...draft, values: { ...draft.values, [field.name]: v } })} />
            ))}
            <div>
              <label htmlFor="draft-status" className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Status</label>
              <select id="draft-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="input-field text-sm capitalize">
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="draft-order" className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Display order</label>
              <input id="draft-order" type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} className="input-field text-sm" />
              <p className="mt-1 text-[11px] text-text-muted">Lower numbers appear first on the website.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            <button type="button" disabled={saving} onClick={save} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">{saving ? "Saving…" : draft.id ? "Save changes" : "Create"}</button>
            <button type="button" onClick={() => setDraft(null)} className="btn-outline px-5 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${mod.label.toLowerCase()}…`} className="input-field py-2 pl-9 text-sm" />
          </div>
          <button type="button" onClick={() => void load()} className="btn-outline px-3 py-2 text-xs"><RefreshCw size={14} /> Refresh</button>
          <button type="button" onClick={exportCsv} className="btn-outline px-3 py-2 text-xs"><Download size={14} /> Export CSV</button>
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-text-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">No records yet. Use “{mod.createLabel ?? "Add new"}” to create the first one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-warm-cream/60 text-left text-[11px] uppercase tracking-[0.12em] text-text-muted">
                  {columns.map((c) => <th key={c} className="px-4 py-2.5 font-bold">{labelOf(c)}</th>)}
                  <th className="px-4 py-2.5 font-bold">Status</th>
                  <th className="px-4 py-2.5 font-bold">Updated</th>
                  <th className="px-4 py-2.5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const link = mod.itemPath?.(item.data);
                  return (
                    <tr key={item.id} className="border-b border-border/60 last:border-0 hover:bg-warm-cream/40">
                      {columns.map((c, i) => (
                        <td key={c} className={`max-w-[280px] truncate px-4 py-3 ${i === 0 ? "font-semibold text-text-primary" : "text-text-muted"}`}>
                          {display(item.data[c], fieldType(c))}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusPill status={item.status} />
                          <select aria-label="Change status" value={item.status} onChange={(e) => void changeStatus(item, e.target.value)} className="rounded-lg border border-border bg-white px-1.5 py-1 text-xs">
                            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-text-muted">{new Date(item.updatedAt).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {link && (
                            <a href={link} target="_blank" rel="noreferrer" title="View on website" className="rounded-lg p-2 text-peacock hover:bg-peacock-light"><ExternalLink size={15} /></a>
                          )}
                          <button type="button" onClick={() => edit(item)} title="Edit" className="rounded-lg p-2 text-burgundy hover:bg-warm-cream"><Pencil size={15} /></button>
                          <button type="button" onClick={() => void remove(item)} title="Delete" className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
