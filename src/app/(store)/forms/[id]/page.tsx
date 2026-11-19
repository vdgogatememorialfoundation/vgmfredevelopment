"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Question = { id: string; label: string; type: "rating" | "text" | "textarea" | "choice"; options?: string[]; required?: boolean };
type Form = { id: string; title: string; description: string; questions: Question[] };

export default function FormPage() {
  const params = useParams<{ id: string }>();
  const formId = String(params.id || "");
  const [form, setForm] = useState<Form | null>(null);
  const [viewer, setViewer] = useState("");
  const [error, setError] = useState("");
  const [signIn, setSignIn] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`/api/forms?id=${encodeURIComponent(formId)}`, { cache: "no-store" })
      .then((response) => response.json() as Promise<{ form?: Form; email?: string; error?: string; signIn?: boolean }>)
      .then((data) => {
        if (data.form) {
          setForm(data.form);
          setViewer(data.email ?? "");
        } else {
          setError(data.error || "This form is no longer available.");
          setSignIn(Boolean(data.signIn));
        }
      })
      .catch(() => setError("The form could not be loaded."));
  }, [formId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/forms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: formId, email, name, answers }) });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not send your answers.");
      setDone(true);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = (key: string, value: string) => setAnswers((prev) => ({ ...prev, [key]: value }));
  const input = "w-full rounded-xl border border-border bg-white px-3 py-3";

  return (
    <div className="container max-w-2xl py-8">
      {!form ? (
        <>
          <h1 className="font-serif text-3xl text-ink">Form</h1>
          <p className="mt-4 text-sm text-text-muted">{error || "Loading…"}</p>
          {signIn ? (
            <Link href={`/login?mode=signin&next=/forms/${formId}`} className="btn-primary mt-4 inline-block">
              Sign in
            </Link>
          ) : null}
        </>
      ) : done ? (
        <>
          <h1 className="font-serif text-3xl text-ink">{form.title}</h1>
          <p className="mt-4 text-sm">Thank you. Your answers were sent to the Foundation.</p>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <h1 className="font-serif text-3xl text-ink">{form.title}</h1>
          {form.description ? <p className="whitespace-pre-line text-sm text-text-muted">{form.description}</p> : null}
          {!viewer ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={input} placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
              <input className={input} type="email" required placeholder="Your email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
          ) : null}
          {form.questions.map((question) => (
            <label key={question.id} className="block text-sm">
              <span className="mb-1 block font-semibold text-text-primary">
                {question.label}
                {question.required ? " *" : ""}
              </span>
              {question.type === "rating" ? (
                <span className="inline-flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => set(question.id, String(star))} className={`text-3xl leading-none ${star <= Number(answers[question.id] || 0) ? "text-amber-500" : "text-slate-300"}`} aria-label={`${star} stars`}>
                      ★
                    </button>
                  ))}
                </span>
              ) : question.type === "textarea" ? (
                <textarea className={input} rows={4} required={question.required} value={answers[question.id] ?? ""} onChange={(event) => set(question.id, event.target.value)} />
              ) : question.type === "choice" ? (
                <select className={input} required={question.required} value={answers[question.id] ?? ""} onChange={(event) => set(question.id, event.target.value)}>
                  <option value="">Choose…</option>
                  {(question.options ?? []).map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input className={input} required={question.required} value={answers[question.id] ?? ""} onChange={(event) => set(question.id, event.target.value)} />
              )}
            </label>
          ))}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button type="submit" disabled={busy} className="rounded-full bg-burgundy px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? "Sending…" : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
}
