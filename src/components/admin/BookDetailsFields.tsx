"use client";

import { Button, Field, TextArea, TextInput } from "@/components/admin/AdminUI";
import { AUDIENCE_TAGS, DETAIL_SECTIONS } from "@/lib/book-details";
import type { Book } from "@/types";

type Props = { form: Book; set: (patch: Partial<Book>) => void };

export function BookSpecFields({ form, set }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Editor"><TextInput value={form.editor ?? ""} onChange={(event) => set({ editor: event.target.value })} /></Field>
      <Field label="Publication date"><TextInput type="date" value={form.publicationDate ?? ""} onChange={(event) => set({ publicationDate: event.target.value || undefined })} /></Field>
      <Field label="Dimensions"><TextInput placeholder="23 × 15 cm" value={form.dimensions ?? ""} onChange={(event) => set({ dimensions: event.target.value })} /></Field>
      <Field label="Paper quality"><TextInput placeholder="70 GSM maplitho" value={form.paperQuality ?? ""} onChange={(event) => set({ paperQuality: event.target.value })} /></Field>
      <Field label="Printing"><TextInput placeholder="Colour / Black & White" value={form.printing ?? ""} onChange={(event) => set({ printing: event.target.value })} /></Field>
      <Field label="Subject"><TextInput placeholder="Ayurveda" value={form.subject ?? ""} onChange={(event) => set({ subject: event.target.value })} /></Field>
      <Field label="Country of origin"><TextInput placeholder="India" value={form.countryOfOrigin ?? ""} onChange={(event) => set({ countryOfOrigin: event.target.value })} /></Field>
    </div>
  );
}

export function BookContentFields({ form, set }: Props) {
  const audience = form.audience ?? [];
  const details = form.details ?? {};
  const people = form.contributors ?? [];
  const custom = audience.filter((tag) => !AUDIENCE_TAGS.includes(tag));
  const patchPerson = (index: number, patch: Partial<NonNullable<Book["contributors"]>[number]>) =>
    set({ contributors: people.map((person, i) => (i === index ? { ...person, ...patch } : person)) });

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Who it is for</p>
        <div className="flex flex-wrap gap-3 text-sm">
          {AUDIENCE_TAGS.map((tag) => (
            <label key={tag} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={audience.includes(tag)}
                onChange={(event) => set({ audience: event.target.checked ? [...audience, tag] : audience.filter((item) => item !== tag) })}
              />
              {tag}
            </label>
          ))}
        </div>
        <TextInput
          className="mt-2"
          placeholder="Other audiences, comma separated"
          value={custom.join(", ")}
          onChange={(event) =>
            set({
              audience: [
                ...audience.filter((tag) => AUDIENCE_TAGS.includes(tag)),
                ...event.target.value.split(",").map((tag) => tag.trimStart()),
              ].filter((tag, index, list) => tag !== "" || index === list.length - 1),
            })
          }
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Book description sections</p>
        <p className="mb-2 text-xs text-text-muted">Empty sections are not shown. Start lines with “-” for bullet points.</p>
        <div className="space-y-3">
          {DETAIL_SECTIONS.map((section) => (
            <Field key={section.key} label={section.label}>
              <TextArea rows={3} value={details[section.key] ?? ""} onChange={(event) => set({ details: { ...details, [section.key]: event.target.value } })} />
            </Field>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Authors and contributors</p>
        <div className="space-y-3">
          {people.map((person, index) => (
            <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
              <Field label="Name"><TextInput value={person.name} onChange={(event) => patchPerson(index, { name: event.target.value })} /></Field>
              <Field label="Role"><TextInput placeholder="Author, Editor, Translator, Reviewer…" value={person.role} onChange={(event) => patchPerson(index, { role: event.target.value })} /></Field>
              <Field label="Photo link (optional)"><TextInput value={person.photo ?? ""} onChange={(event) => patchPerson(index, { photo: event.target.value })} /></Field>
              <div className="flex items-end"><Button variant="ghost" onClick={() => set({ contributors: people.filter((_, i) => i !== index) })}>Remove</Button></div>
              <div className="sm:col-span-2">
                <Field label="Short profile"><TextArea rows={2} value={person.bio ?? ""} onChange={(event) => patchPerson(index, { bio: event.target.value })} /></Field>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={() => set({ contributors: [...people, { name: "", role: people.length ? "Contributor" : "Author" }] })}>+ Add person</Button>
        </div>
      </div>
    </div>
  );
}
