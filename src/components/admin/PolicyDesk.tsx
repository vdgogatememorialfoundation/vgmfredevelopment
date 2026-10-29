"use client";

import { useState } from "react";
import { getPolicies, policyIds, savePolicy, type PolicyDoc, type PolicyId, type PolicySection } from "@/lib/policies";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const button = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white";
const ghost = "rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700";

export function PolicyDesk() {
  const [docs, setDocs] = useState(() => getPolicies());
  const [selected, setSelected] = useState<PolicyId>("privacy");
  const [draft, setDraft] = useState<PolicyDoc>(() => getPolicies().privacy);
  const [saved, setSaved] = useState("");

  const open = (id: PolicyId) => {
    const next = getPolicies()[id];
    setSelected(id);
    setDraft(next);
    setSaved("");
  };

  const setSection = (index: number, patch: Partial<PolicySection>) => {
    setDraft({
      ...draft,
      sections: draft.sections.map((section, i) => (i === index ? { ...section, ...patch } : section)),
    });
  };

  const save = () => {
    const next = {
      ...draft,
      title: draft.title.trim() || docs[selected].title,
      description: draft.description.trim(),
      sections: draft.sections.filter((section) => section.title.trim() || section.body.trim()),
    };
    savePolicy(next);
    setDocs(getPolicies());
    setDraft(getPolicies()[selected]);
    setSaved("Saved. The public policy page now shows this text.");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Policies</h1>
        <p className="text-xs text-slate-500">Edit the legal pages shown in the website footer.</p>
        <nav className="mt-4 grid gap-1">
          {policyIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => open(id)}
              className={`rounded-lg px-3 py-2 text-left text-sm ${selected === id ? "bg-burgundy/10 font-semibold text-burgundy" : "text-slate-700 hover:bg-slate-50"}`}
            >
              {docs[id].title}
            </button>
          ))}
        </nav>
      </aside>
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <input className={field} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <textarea className={field} rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        {draft.sections.map((section, index) => (
          <div key={`${section.title}-${index}`} className="grid gap-2 rounded-lg border border-slate-100 p-3">
            <input className={field} placeholder="Section title" value={section.title} onChange={(event) => setSection(index, { title: event.target.value })} />
            <textarea className={field} rows={4} placeholder="Section text" value={section.body} onChange={(event) => setSection(index, { body: event.target.value })} />
            <button
              type="button"
              className="justify-self-start text-xs font-semibold text-red-600"
              onClick={() => setDraft({ ...draft, sections: draft.sections.filter((_, i) => i !== index) })}
            >
              Remove section
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={ghost}
            onClick={() => setDraft({ ...draft, sections: [...draft.sections, { title: "", body: "" }] })}
          >
            Add section
          </button>
          <button type="button" className={button} onClick={save}>
            Save policy
          </button>
        </div>
        {saved && <p className="text-sm text-emerald-700">{saved}</p>}
      </section>
    </div>
  );
}
