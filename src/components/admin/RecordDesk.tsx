"use client";

import { useState } from "react";
import Link from "next/link";

type Field = {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "select";
  options?: string[];
};

const fieldClass = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

export default function RecordDesk<T extends { id: string }>({
  heading,
  description,
  publicHref,
  records,
  fields,
  blank,
  label,
  onSave,
  onHide,
}: {
  heading: string;
  description: string;
  publicHref: string;
  records: T[];
  fields: Field[];
  blank: () => T;
  label: (record: T) => string;
  onSave: (record: T) => void;
  onHide: (id: string) => void;
}) {
  const [draft, setDraft] = useState<T>(() => blank());
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");

  const update = (key: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    const required = fields[0];
    const value = String((draft as Record<string, unknown>)[required.key] ?? "").trim();
    if (!value) {
      setMessage(`Add a ${required.label.toLowerCase()} before saving.`);
      return;
    }
    onSave(draft);
    setMessage("Published. Open the site page to see it.");
    setDraft(blank());
    setEditing(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
        </div>
        <Link href={publicHref} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
          View on the site
        </Link>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-800">{editing ? "Edit record" : "Add to the site"}</p>
        {fields.map((field) =>
          field.kind === "select" ? (
            <label key={field.key} className="block text-xs font-semibold text-slate-500">
              {field.label}
              <select
                className={`${fieldClass} mt-1`}
                value={String((draft as Record<string, unknown>)[field.key] ?? "")}
                onChange={(event) => update(field.key, event.target.value)}
              >
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          ) : field.kind === "textarea" ? (
            <textarea
              key={field.key}
              className={fieldClass}
              rows={4}
              placeholder={field.label}
              value={String((draft as Record<string, unknown>)[field.key] ?? "")}
              onChange={(event) => update(field.key, event.target.value)}
            />
          ) : (
            <input
              key={field.key}
              className={fieldClass}
              placeholder={field.label}
              value={String((draft as Record<string, unknown>)[field.key] ?? "")}
              onChange={(event) => update(field.key, event.target.value)}
            />
          )
        )}
        <button type="button" className="rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white" onClick={save}>
          Save and publish
        </button>
        {message && <p className="text-sm text-emerald-700">{message}</p>}
      </div>
      <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {records.map((record) => (
          <li key={record.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0">
            <p className="font-semibold text-slate-900">{label(record)}</p>
            <div className="flex gap-3 text-sm font-semibold">
              <button
                type="button"
                className="text-burgundy"
                onClick={() => {
                  setDraft(record);
                  setEditing(true);
                  setMessage("");
                }}
              >
                Edit
              </button>
              <button type="button" className="text-slate-400" onClick={() => onHide(record.id)}>
                Hide
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
