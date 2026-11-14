"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = { id: string; title: string; description: string; answered?: boolean };

export default function FormsPage() {
  const [forms, setForms] = useState<Row[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void fetch("/api/forms", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ forms?: Row[]; email?: string }>)
      .then((data) => {
        setForms(data.forms ?? []);
        setSignedIn(Boolean(data.email));
      })
      .catch(() => setForms([]));
  }, []);

  return (
    <div className="container py-8">
      <h1 className="font-serif text-3xl text-ink">Feedback & forms</h1>
      <p className="mt-2 max-w-xl text-sm text-text-muted">Forms the Foundation has asked you to fill in. Your answers go straight to the Foundation team.</p>
      {forms === null ? <p className="mt-6 text-sm text-text-muted">Loading…</p> : null}
      {forms?.length === 0 ? (
        <p className="mt-6 text-sm text-text-muted">
          No forms are open for you right now.{" "}
          {!signedIn ? (
            <Link href="/login?mode=signin&next=/forms" className="font-semibold text-burgundy">
              Sign in
            </Link>
          ) : null}
        </p>
      ) : null}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {forms?.map((form) => (
          <Link key={form.id} href={`/forms/${form.id}`} className="rounded-xl border border-border bg-white p-5 hover:border-burgundy">
            <h2 className="font-serif text-xl text-ink">{form.title}</h2>
            {form.description ? <p className="mt-2 line-clamp-3 text-sm text-text-muted">{form.description}</p> : null}
            <p className="mt-3 text-sm font-semibold text-burgundy">{form.answered ? "Answered · edit your answers" : "Fill in the form"}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
