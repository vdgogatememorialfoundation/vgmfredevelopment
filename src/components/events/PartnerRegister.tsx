"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { partnerPortalLabel } from "@/lib/partner-labels";
import type { PartnerPortalId } from "@/types";

type Field = {
  key?: string;
  type?: string;
  label?: string;
  required?: boolean;
  enabled?: boolean;
  options?: { value?: string; label?: string }[] | string[];
};

function optionList(field: Field) {
  return (field.options || []).map((option) => {
    if (typeof option === "string") return { value: option, label: option };
    return { value: String(option.value || option.label || ""), label: String(option.label || option.value || "") };
  }).filter((option) => option.value);
}

export default function PartnerRegister({ portal, seminarId, phase = "main" }: { portal: PartnerPortalId; seminarId: number; phase?: "pre" | "main" }) {
  const { user } = useAuth();
  const [fields, setFields] = useState<Field[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const label = partnerPortalLabel(portal);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/partners/registrations?portal=${portal}&seminarId=${seminarId}&phase=${phase}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { error?: string; form?: { fields?: Field[] } } | null;
        if (cancelled) return;
        if (!response.ok) {
          setNote(data?.error || "The registration form is not available.");
          setFields([]);
          return;
        }
        const next = (data?.form?.fields || []).filter((field) => field.enabled !== false && field.key);
        setFields(next);
        setValues((current) => ({
          ...current,
          fname: current.fname || user?.firstName || "",
          lname: current.lname || user?.lastName || "",
          email: current.email || user?.email || "",
          phone: current.phone || user?.phone || "",
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setNote("The registration form is not available.");
          setFields([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [phase, portal, seminarId, user?.email, user?.firstName, user?.lastName, user?.phone]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setNote("");
    const body = new FormData();
    body.set("portal", portal);
    body.set("seminarId", String(seminarId));
    body.set("phase", phase);
    body.set("formData", JSON.stringify(values));
    if (file) body.set("certificate", file);
    try {
      const response = await fetch("/api/partners/registrations", { method: "POST", body, credentials: "same-origin" });
      const data = (await response.json().catch(() => null)) as { error?: string; message?: string; applicationNo?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Registration was not saved.");
      setDone(data?.applicationNo ? `${data.message} Application ${data.applicationNo}.` : data?.message || "Registered.");
    } catch (error) {
      setNote((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!Number.isInteger(seminarId) || seminarId < 1) return null;

  return (
    <div className="mt-5 border-t border-border pt-5">
      <h2 className="text-sm font-semibold text-ink">{phase === "pre" ? "Pre-register" : "Register"} on {label}</h2>
      {!user && (
        <p className="mt-3 text-sm text-text-muted">
          <Link href={`/login?next=/events`} className="font-semibold text-burgundy">Sign in</Link> to register. The application is saved on {label}.
        </p>
      )}
      {user && fields === null && <p className="mt-3 text-sm text-text-muted">Loading the registration form…</p>}
      {user && done && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-emerald-800">{done}</p>
          <Link href="/account/registrations" className="btn-outline">My Event Registrations</Link>
        </div>
      )}
      {user && fields && !done && (
        <form className="mt-3 space-y-3" onSubmit={(event) => void submit(event)}>
          {fields.map((field) => {
            const key = field.key || "";
            const required = Boolean(field.required);
            const type = (field.type || "text").toLowerCase();
            const common = "w-full rounded-xl border border-border px-3 py-2 text-sm";
            if (type === "file" || key === "certificate") {
              return (
                <label key={key} className="block text-sm">
                  <span className="font-medium text-ink">{field.label || "Certificate"}{required ? " *" : ""}</span>
                  <input
                    className="mt-1 block w-full text-sm"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    required={required}
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                  />
                </label>
              );
            }
            if (key.includes("agree")) {
              return (
                <label key={key} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    required={required}
                    checked={values[key] === "yes"}
                    onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.checked ? "yes" : "" }))}
                  />
                  <span>{field.label || "I confirm the information is accurate"}</span>
                </label>
              );
            }
            if (type === "select") {
              return (
                <label key={key} className="block text-sm">
                  <span className="font-medium text-ink">{field.label || key}{required ? " *" : ""}</span>
                  <select
                    className={`${common} mt-1`}
                    required={required}
                    value={values[key] || ""}
                    onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                  >
                    <option value="">Select</option>
                    {optionList(field).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              );
            }
            if (type === "textarea") {
              return (
                <label key={key} className="block text-sm">
                  <span className="font-medium text-ink">{field.label || key}{required ? " *" : ""}</span>
                  <textarea
                    className={`${common} mt-1`}
                    rows={3}
                    required={required}
                    value={values[key] || ""}
                    onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                  />
                </label>
              );
            }
            return (
              <label key={key} className="block text-sm">
                <span className="font-medium text-ink">{field.label || key}{required ? " *" : ""}</span>
                <input
                  className={`${common} mt-1`}
                  type={type === "email" || type === "tel" || type === "date" ? type : "text"}
                  required={required}
                  value={values[key] || ""}
                  onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                />
              </label>
            );
          })}
          {note && <p className="text-sm text-burgundy">{note}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy || fields.length === 0}>
            {busy ? "Saving…" : phase === "pre" ? `Pre-register on ${label}` : `Register on ${label}`}
          </button>
        </form>
      )}
    </div>
  );
}
