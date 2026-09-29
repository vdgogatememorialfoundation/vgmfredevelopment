"use client";

import type { FieldDef } from "@/lib/cms/modules";

export type FormValue = string | boolean;

export function toFormValue(field: FieldDef, value: unknown): FormValue {
  if (field.type === "boolean") return value === true;
  if (value === undefined || value === null) return "";
  if (field.type === "tags" && Array.isArray(value)) return value.join(", ");
  if (field.type === "json") return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return String(value);
}

export default function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: FormValue;
  onChange: (value: FormValue) => void;
}) {
  const id = `field-${field.name}`;
  const common = "input-field text-sm";
  let control: React.ReactNode;
  switch (field.type) {
    case "boolean":
      control = (
        <label htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5 text-sm">
          <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-burgundy)]" />
          <span className="font-medium text-text-primary">{value === true ? "Yes" : "No"}</span>
        </label>
      );
      break;
    case "textarea":
    case "json":
      control = (
        <textarea
          id={id}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          rows={field.type === "json" ? 6 : 4}
          placeholder={field.placeholder}
          className={`${common} ${field.type === "json" ? "font-mono text-xs" : ""}`}
        />
      );
      break;
    case "select":
      control = (
        <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)} className={common}>
          <option value="">— Select —</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option || "Default"}
            </option>
          ))}
        </select>
      );
      break;
    default:
      control = (
        <input
          id={id}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : "text"}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? (field.type === "url" || field.type === "image" ? "https://…" : undefined)}
          className={common}
          step={field.type === "number" ? "any" : undefined}
        />
      );
  }
  const wide = field.type === "textarea" || field.type === "json";
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
        {field.label}
        {field.required && <span className="text-burgundy"> *</span>}
      </label>
      {control}
      {field.type === "image" && typeof value === "string" && /^https?:\/\//.test(value) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mt-2 h-20 w-32 rounded-lg border border-border object-cover" />
      )}
      {field.help && <p className="mt-1 text-[11px] text-text-muted">{field.help}</p>}
    </div>
  );
}
