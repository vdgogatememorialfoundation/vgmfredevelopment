"use client";

import { useState } from "react";
import Link from "next/link";
import { ImageField } from "@/components/admin/ImageField";
import { fileToStoredUrl } from "@/lib/images";
import { getAbout, resetAbout, saveAbout, type AboutContent, type AboutPerson, type AboutPhoto, type AboutSection, type FamilyNode, type TimelineEntry } from "@/lib/about";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const button = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white";
const ghost = "rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700";
const card = "space-y-4 rounded-xl border border-slate-200 bg-white p-5";

const tabs = ["Page & sections", "Inner pages", "Photo gallery", "Legacy & timeline", "Legacy tree"] as const;
const innerTabs = ["Foundation", "History", "Trustees & team", "Anagha", "Awards", "Books & research"] as const;

function descendantsOf(nodes: FamilyNode[], id: string): Set<string> {
  const found = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of nodes) {
      if (node.parentId && found.has(node.parentId) && !found.has(node.id)) {
        found.add(node.id);
        grew = true;
      }
    }
  }
  return found;
}

export default function AboutDesk() {
  const [draft, setDraft] = useState<AboutContent>(() => getAbout());
  const [tab, setTab] = useState<(typeof tabs)[number]>(tabs[0]);
  const [inner, setInner] = useState<(typeof innerTabs)[number]>(innerTabs[0]);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const set = (patch: Partial<AboutContent>) => setDraft((current) => ({ ...current, ...patch }));
  const setLegacy = (patch: Partial<AboutContent["legacy"]>) => setDraft((current) => ({ ...current, legacy: { ...current.legacy, ...patch } }));
  const setFoundation = (patch: Partial<AboutContent["foundation"]>) => setDraft((current) => ({ ...current, foundation: { ...current.foundation, ...patch } }));
  const setHistory = (patch: Partial<AboutContent["history"]>) => setDraft((current) => ({ ...current, history: { ...current.history, ...patch } }));
  const setTrustees = (patch: Partial<AboutContent["trustees"]>) => setDraft((current) => ({ ...current, trustees: { ...current.trustees, ...patch } }));
  const setAnagha = (patch: Partial<AboutContent["anagha"]>) => setDraft((current) => ({ ...current, anagha: { ...current.anagha, ...patch } }));
  const setAwards = (patch: Partial<AboutContent["awards"]>) => setDraft((current) => ({ ...current, awards: { ...current.awards, ...patch } }));
  const setScholarship = (patch: Partial<AboutContent["scholarship"]>) => setDraft((current) => ({ ...current, scholarship: { ...current.scholarship, ...patch } }));
  const editList = <T extends { id: string }>(list: T[], id: string, patch: Partial<T>) => list.map((item) => (item.id === id ? { ...item, ...patch } : item));
  const move = <T,>(list: T[], index: number, delta: number) => {
    const next = [...list];
    const target = index + delta;
    if (target < 0 || target >= next.length) return list;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };

  const save = () => {
    try {
      saveAbout(draft);
      setMessage("Saved. The About pages now show these changes.");
    } catch {
      setMessage("The browser storage is full. Remove some uploaded photos or use image URLs.");
    }
  };

  const uploadGallery = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setMessage("");
    try {
      const added: AboutPhoto[] = [];
      for (const file of Array.from(files)) {
        added.push({ id: `ph-${Date.now()}-${added.length}`, src: await fileToStoredUrl(file), title: file.name.replace(/\.[^.]+$/, ""), description: "" });
      }
      set({ gallery: [...draft.gallery, ...added] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload the photos.");
    } finally {
      setUploading(false);
    }
  };

  const tree = draft.legacy.tree;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">About Us</h1>
          <p className="mt-1 text-sm text-slate-500">Edit every About page — sections, images and text for Foundation, History, Trustees, Legacy — plus the photo gallery.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/about" className={ghost}>View About</Link>
          <Link href="/about/foundation" className={ghost}>Foundation</Link>
          <Link href="/about/history" className={ghost}>History</Link>
          <Link href="/about/trustees" className={ghost}>Trustees</Link>
          <Link href="/about/legacy-of-vaidya-rb-gogate" className={ghost}>Legacy</Link>
          <Link href="/about/dr-anagha-gogate" className={ghost}>Anagha</Link>
          <Link href="/about/awards" className={ghost}>Awards</Link>
          <Link href="/about/books-and-research" className={ghost}>Books</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === item ? "bg-burgundy text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
            {item}
          </button>
        ))}
      </div>

      {tab === "Page & sections" && (
        <>
          <div className={card}>
            <input className={field} placeholder="Page title" value={draft.title} onChange={(event) => set({ title: event.target.value })} />
            <textarea className={field} rows={12} placeholder="Introduction from the family" value={draft.intro} onChange={(event) => set({ intro: event.target.value })} />
            <ImageField label="Wide banner image (optional)" value={draft.heroImage} onChange={(heroImage) => set({ heroImage })} />
          </div>
          <div className={card}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">Sections</p>
              <button type="button" className="text-sm font-semibold text-burgundy" onClick={() => set({ sections: [...draft.sections, { id: `s-${Date.now()}`, title: "", body: "" }] })}>+ Add section</button>
            </div>
            {draft.sections.map((section: AboutSection, index) => (
              <div key={section.id} className="grid gap-3 rounded-lg border border-slate-100 p-4 lg:grid-cols-[1fr_260px]">
                <div className="space-y-2">
                  <input className={field} placeholder="Heading" value={section.title} onChange={(event) => set({ sections: editList(draft.sections, section.id, { title: event.target.value }) })} />
                  <textarea className={field} rows={3} placeholder="Text" value={section.body} onChange={(event) => set({ sections: editList(draft.sections, section.id, { body: event.target.value }) })} />
                  <input className={field} placeholder="Link (optional), e.g. /about/history" value={section.href ?? ""} onChange={(event) => set({ sections: editList(draft.sections, section.id, { href: event.target.value }) })} />
                  <div className="flex gap-3 text-xs font-semibold">
                    <button type="button" className="text-slate-500" onClick={() => set({ sections: move(draft.sections, index, -1) })}>Up</button>
                    <button type="button" className="text-slate-500" onClick={() => set({ sections: move(draft.sections, index, 1) })}>Down</button>
                    <button type="button" className="text-red-600" onClick={() => set({ sections: draft.sections.filter((item) => item.id !== section.id) })}>Remove</button>
                  </div>
                </div>
                <ImageField label="Image" value={section.image} onChange={(image) => set({ sections: editList(draft.sections, section.id, { image }) })} />
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "Inner pages" && (
        <>
          <div className="flex flex-wrap gap-2">
            {innerTabs.map((item) => (
              <button key={item} type="button" onClick={() => setInner(item)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${inner === item ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
                {item}
              </button>
            ))}
          </div>
          {inner === "Foundation" && (
            <>
              <div className={card}>
                <input className={field} placeholder="Page title" value={draft.foundation.title} onChange={(event) => setFoundation({ title: event.target.value })} />
                <textarea className={field} rows={3} placeholder="Introduction" value={draft.foundation.intro} onChange={(event) => setFoundation({ intro: event.target.value })} />
              </div>
              <div className={card}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">Mission, vision and other sections</p>
                  <button type="button" className="text-sm font-semibold text-burgundy" onClick={() => setFoundation({ sections: [...draft.foundation.sections, { id: `f-${Date.now()}`, title: "", body: "" }] })}>+ Add section</button>
                </div>
                {draft.foundation.sections.map((section: AboutSection, index) => (
                  <div key={section.id} className="grid gap-3 rounded-lg border border-slate-100 p-4 lg:grid-cols-[1fr_260px]">
                    <div className="space-y-2">
                      <input className={field} placeholder="Heading" value={section.title} onChange={(event) => setFoundation({ sections: editList(draft.foundation.sections, section.id, { title: event.target.value }) })} />
                      <textarea className={field} rows={4} placeholder="Text (one objective per line for lists)" value={section.body} onChange={(event) => setFoundation({ sections: editList(draft.foundation.sections, section.id, { body: event.target.value }) })} />
                      <div className="flex gap-3 text-xs font-semibold">
                        <button type="button" className="text-slate-500" onClick={() => setFoundation({ sections: move(draft.foundation.sections, index, -1) })}>Up</button>
                        <button type="button" className="text-slate-500" onClick={() => setFoundation({ sections: move(draft.foundation.sections, index, 1) })}>Down</button>
                        <button type="button" className="text-red-600" onClick={() => setFoundation({ sections: draft.foundation.sections.filter((item) => item.id !== section.id) })}>Remove</button>
                      </div>
                    </div>
                    <ImageField label="Image" value={section.image} onChange={(image) => setFoundation({ sections: editList(draft.foundation.sections, section.id, { image }) })} />
                  </div>
                ))}
              </div>
              <div className={card}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">Activities</p>
                  <button type="button" className="text-sm font-semibold text-burgundy" onClick={() => setFoundation({ activities: [...draft.foundation.activities, { id: `a-${Date.now()}`, title: "", body: "" }] })}>+ Add activity</button>
                </div>
                {draft.foundation.activities.map((activity: AboutSection, index) => (
                  <div key={activity.id} className="space-y-2 rounded-lg border border-slate-100 p-3">
                    <input className={field} placeholder="Title" value={activity.title} onChange={(event) => setFoundation({ activities: editList(draft.foundation.activities, activity.id, { title: event.target.value }) })} />
                    <textarea className={field} rows={2} placeholder="Description" value={activity.body} onChange={(event) => setFoundation({ activities: editList(draft.foundation.activities, activity.id, { body: event.target.value }) })} />
                    <input className={field} placeholder="Link (optional), e.g. /clinics" value={activity.href ?? ""} onChange={(event) => setFoundation({ activities: editList(draft.foundation.activities, activity.id, { href: event.target.value }) })} />
                    <div className="flex gap-3 text-xs font-semibold">
                      <button type="button" className="text-slate-500" onClick={() => setFoundation({ activities: move(draft.foundation.activities, index, -1) })}>Up</button>
                      <button type="button" className="text-slate-500" onClick={() => setFoundation({ activities: move(draft.foundation.activities, index, 1) })}>Down</button>
                      <button type="button" className="text-red-600" onClick={() => setFoundation({ activities: draft.foundation.activities.filter((item) => item.id !== activity.id) })}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {inner === "History" && (
            <>
              <div className={card}>
                <input className={field} placeholder="Page title" value={draft.history.title} onChange={(event) => setHistory({ title: event.target.value })} />
                <textarea className={field} rows={3} placeholder="Introduction" value={draft.history.intro} onChange={(event) => setHistory({ intro: event.target.value })} />
              </div>
              <div className={card}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">Timeline</p>
                  <button type="button" className="text-sm font-semibold text-burgundy" onClick={() => setHistory({ timeline: [...draft.history.timeline, { id: `h-${Date.now()}`, year: "", title: "", description: "" }] })}>+ Add entry</button>
                </div>
                {draft.history.timeline.map((entry: TimelineEntry, index) => (
                  <div key={entry.id} className="grid gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-[110px_1fr]">
                    <input className={field} placeholder="Year" value={entry.year} onChange={(event) => setHistory({ timeline: editList(draft.history.timeline, entry.id, { year: event.target.value }) })} />
                    <input className={field} placeholder="Title" value={entry.title} onChange={(event) => setHistory({ timeline: editList(draft.history.timeline, entry.id, { title: event.target.value }) })} />
                    <textarea className={`${field} sm:col-span-2`} rows={2} placeholder="Description" value={entry.description} onChange={(event) => setHistory({ timeline: editList(draft.history.timeline, entry.id, { description: event.target.value }) })} />
                    <div className="flex gap-3 text-xs font-semibold">
                      <button type="button" className="text-slate-500" onClick={() => setHistory({ timeline: move(draft.history.timeline, index, -1) })}>Up</button>
                      <button type="button" className="text-slate-500" onClick={() => setHistory({ timeline: move(draft.history.timeline, index, 1) })}>Down</button>
                      <button type="button" className="text-red-600" onClick={() => setHistory({ timeline: draft.history.timeline.filter((item) => item.id !== entry.id) })}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {inner === "Trustees & team" && (
            <>
              <div className={card}>
                <input className={field} placeholder="Page title" value={draft.trustees.title} onChange={(event) => setTrustees({ title: event.target.value })} />
                <textarea className={field} rows={3} placeholder="Introduction" value={draft.trustees.intro} onChange={(event) => setTrustees({ intro: event.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={field} placeholder="Trustees heading" value={draft.trustees.trusteesHeading} onChange={(event) => setTrustees({ trusteesHeading: event.target.value })} />
                  <input className={field} placeholder="Team heading" value={draft.trustees.teamHeading} onChange={(event) => setTrustees({ teamHeading: event.target.value })} />
                </div>
              </div>
              <div className={card}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">Trustees</p>
                  <button type="button" className="text-sm font-semibold text-burgundy" onClick={() => setTrustees({ trustees: [...draft.trustees.trustees, { id: `tr-${Date.now()}`, name: "", role: "", bio: "" }] })}>+ Add trustee</button>
                </div>
                {draft.trustees.trustees.map((person: AboutPerson) => (
                  <div key={person.id} className="grid gap-3 rounded-lg border border-slate-100 p-4 lg:grid-cols-[220px_1fr]">
                    <ImageField label="Photo" value={person.photo} maxWidth={500} onChange={(photo) => setTrustees({ trustees: editList(draft.trustees.trustees, person.id, { photo }) })} />
                    <div className="space-y-2">
                      <input className={field} placeholder="Name" value={person.name} onChange={(event) => setTrustees({ trustees: editList(draft.trustees.trustees, person.id, { name: event.target.value }) })} />
                      <input className={field} placeholder="Role" value={person.role} onChange={(event) => setTrustees({ trustees: editList(draft.trustees.trustees, person.id, { role: event.target.value }) })} />
                      <textarea className={field} rows={2} placeholder="Short biography" value={person.bio ?? ""} onChange={(event) => setTrustees({ trustees: editList(draft.trustees.trustees, person.id, { bio: event.target.value }) })} />
                      <button type="button" className="text-xs font-semibold text-red-600" onClick={() => setTrustees({ trustees: draft.trustees.trustees.filter((item) => item.id !== person.id) })}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className={card}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">Team</p>
                  <button type="button" className="text-sm font-semibold text-burgundy" onClick={() => setTrustees({ team: [...draft.trustees.team, { id: `tm-${Date.now()}`, name: "", role: "" }] })}>+ Add team member</button>
                </div>
                {draft.trustees.team.map((person: AboutPerson) => (
                  <div key={person.id} className="grid gap-3 rounded-lg border border-slate-100 p-4 lg:grid-cols-[220px_1fr]">
                    <ImageField label="Photo" value={person.photo} maxWidth={500} onChange={(photo) => setTrustees({ team: editList(draft.trustees.team, person.id, { photo }) })} />
                    <div className="space-y-2">
                      <input className={field} placeholder="Name" value={person.name} onChange={(event) => setTrustees({ team: editList(draft.trustees.team, person.id, { name: event.target.value }) })} />
                      <input className={field} placeholder="Role" value={person.role} onChange={(event) => setTrustees({ team: editList(draft.trustees.team, person.id, { role: event.target.value }) })} />
                      <textarea className={field} rows={2} placeholder="Note (optional)" value={person.bio ?? ""} onChange={(event) => setTrustees({ team: editList(draft.trustees.team, person.id, { bio: event.target.value }) })} />
                      <button type="button" className="text-xs font-semibold text-red-600" onClick={() => setTrustees({ team: draft.trustees.team.filter((item) => item.id !== person.id) })}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {inner === "Anagha" && (
            <div className={`${card} grid gap-4 lg:grid-cols-[1fr_280px]`}>
              <div className="space-y-3">
                <input className={field} placeholder="Page title" value={draft.anagha.title} onChange={(event) => setAnagha({ title: event.target.value })} />
                <textarea className={field} rows={3} placeholder="Introduction" value={draft.anagha.intro} onChange={(event) => setAnagha({ intro: event.target.value })} />
                <textarea className={field} rows={10} placeholder="Biography" value={draft.anagha.biography} onChange={(event) => setAnagha({ biography: event.target.value })} />
              </div>
              <ImageField label="Portrait" value={draft.anagha.portrait} onChange={(portrait) => setAnagha({ portrait })} />
            </div>
          )}
          {inner === "Awards" && (
            <>
              <div className={card}>
                <input className={field} placeholder="Page title" value={draft.awards.title} onChange={(event) => setAwards({ title: event.target.value })} />
                <textarea className={field} rows={3} placeholder="Introduction" value={draft.awards.intro} onChange={(event) => setAwards({ intro: event.target.value })} />
              </div>
              <div className={card}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">Awards</p>
                  <button type="button" className="text-sm font-semibold text-burgundy" onClick={() => setAwards({ items: [...draft.awards.items, { id: `aw-${Date.now()}`, title: "", body: "" }] })}>+ Add award</button>
                </div>
                {draft.awards.items.map((item: AboutSection, index) => (
                  <div key={item.id} className="grid gap-3 rounded-lg border border-slate-100 p-4 lg:grid-cols-[1fr_220px]">
                    <div className="space-y-2">
                      <input className={field} placeholder="Award name" value={item.title} onChange={(event) => setAwards({ items: editList(draft.awards.items, item.id, { title: event.target.value }) })} />
                      <textarea className={field} rows={3} placeholder="Citation" value={item.body} onChange={(event) => setAwards({ items: editList(draft.awards.items, item.id, { body: event.target.value }) })} />
                      <div className="flex gap-3 text-xs font-semibold">
                        <button type="button" className="text-slate-500" onClick={() => setAwards({ items: move(draft.awards.items, index, -1) })}>Up</button>
                        <button type="button" className="text-slate-500" onClick={() => setAwards({ items: move(draft.awards.items, index, 1) })}>Down</button>
                        <button type="button" className="text-red-600" onClick={() => setAwards({ items: draft.awards.items.filter((entry) => entry.id !== item.id) })}>Remove</button>
                      </div>
                    </div>
                    <ImageField label="Image" value={item.image} onChange={(image) => setAwards({ items: editList(draft.awards.items, item.id, { image }) })} />
                  </div>
                ))}
              </div>
            </>
          )}
          {inner === "Books & research" && (
            <>
              <div className={card}>
                <input className={field} placeholder="Page title" value={draft.scholarship.title} onChange={(event) => setScholarship({ title: event.target.value })} />
                <textarea className={field} rows={3} placeholder="Introduction" value={draft.scholarship.intro} onChange={(event) => setScholarship({ intro: event.target.value })} />
              </div>
              <div className={card}>
                <input className={field} placeholder="Books heading" value={draft.scholarship.booksTitle} onChange={(event) => setScholarship({ booksTitle: event.target.value })} />
                <textarea className={field} rows={6} placeholder="One book title per line" value={draft.scholarship.books.join("\n")} onChange={(event) => setScholarship({ books: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })} />
              </div>
              <div className={card}>
                <input className={field} placeholder="Research heading" value={draft.scholarship.researchTitle} onChange={(event) => setScholarship({ researchTitle: event.target.value })} />
                <textarea className={field} rows={6} placeholder="One research subject per line" value={draft.scholarship.research.join("\n")} onChange={(event) => setScholarship({ research: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })} />
              </div>
            </>
          )}
        </>
      )}

      {tab === "Photo gallery" && (
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">Photo gallery</p>
              <p className="text-xs text-slate-500">Each photo has its own title and description, shown under the photo on the About page.</p>
            </div>
            <div className="flex gap-2">
              <label className={`${ghost} cursor-pointer`}>
                {uploading ? "Uploading…" : "Upload photos"}
                <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => uploadGallery(event.target.files)} />
              </label>
              <button type="button" className={ghost} onClick={() => set({ gallery: [...draft.gallery, { id: `ph-${Date.now()}`, src: "", title: "", description: "" }] })}>Add by URL</button>
            </div>
          </div>
          {draft.gallery.length === 0 && <p className="text-sm text-slate-500">No photos yet.</p>}
          <ul className="grid gap-4 md:grid-cols-2">
            {draft.gallery.map((photo, index) => (
              <li key={photo.id} className="flex gap-3 rounded-lg border border-slate-100 p-3">
                <div className="h-24 w-32 shrink-0 overflow-hidden rounded-md bg-slate-100">
                  {photo.src && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.src} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {!photo.src.startsWith("data:") && (
                    <input className={field} placeholder="Image URL" value={photo.src} onChange={(event) => set({ gallery: editList(draft.gallery, photo.id, { src: event.target.value }) })} />
                  )}
                  <input className={field} placeholder="Title" value={photo.title} onChange={(event) => set({ gallery: editList(draft.gallery, photo.id, { title: event.target.value }) })} />
                  <textarea className={field} rows={2} placeholder="Description" value={photo.description} onChange={(event) => set({ gallery: editList(draft.gallery, photo.id, { description: event.target.value }) })} />
                  <div className="flex gap-3 text-xs font-semibold">
                    <button type="button" className="text-slate-500" onClick={() => set({ gallery: move(draft.gallery, index, -1) })}>Up</button>
                    <button type="button" className="text-slate-500" onClick={() => set({ gallery: move(draft.gallery, index, 1) })}>Down</button>
                    <button type="button" className="text-red-600" onClick={() => set({ gallery: draft.gallery.filter((item) => item.id !== photo.id) })}>Remove</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "Legacy & timeline" && (
        <>
          <div className={`${card} grid gap-4 lg:grid-cols-[1fr_280px]`}>
            <div className="space-y-3">
              <input className={field} placeholder="Legacy page title" value={draft.legacy.title} onChange={(event) => setLegacy({ title: event.target.value })} />
              <textarea className={field} rows={3} placeholder="Introduction" value={draft.legacy.intro} onChange={(event) => setLegacy({ intro: event.target.value })} />
              <textarea className={field} rows={7} placeholder="Biography in English (blank line between paragraphs)" value={draft.legacy.biography} onChange={(event) => setLegacy({ biography: event.target.value })} />
              <textarea className={field} rows={7} placeholder="मराठी चरित्र" value={draft.legacy.biographyMr} onChange={(event) => setLegacy({ biographyMr: event.target.value })} />
              <textarea className={field} rows={4} placeholder="Philosophy" value={draft.legacy.philosophy} onChange={(event) => setLegacy({ philosophy: event.target.value })} />
            </div>
            <ImageField label="Portrait" value={draft.legacy.portrait} onChange={(portrait) => setLegacy({ portrait })} />
          </div>
          <div className={card}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">Timeline</p>
              <button type="button" className="text-sm font-semibold text-burgundy" onClick={() => setLegacy({ timeline: [...draft.legacy.timeline, { id: `t-${Date.now()}`, year: "", title: "", description: "" }] })}>+ Add entry</button>
            </div>
            {draft.legacy.timeline.map((entry: TimelineEntry, index) => (
              <div key={entry.id} className="grid gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-[110px_1fr]">
                <input className={field} placeholder="Year" value={entry.year} onChange={(event) => setLegacy({ timeline: editList(draft.legacy.timeline, entry.id, { year: event.target.value }) })} />
                <input className={field} placeholder="Title" value={entry.title} onChange={(event) => setLegacy({ timeline: editList(draft.legacy.timeline, entry.id, { title: event.target.value }) })} />
                <textarea className={`${field} sm:col-span-2`} rows={2} placeholder="Description" value={entry.description} onChange={(event) => setLegacy({ timeline: editList(draft.legacy.timeline, entry.id, { description: event.target.value }) })} />
                <div className="flex gap-3 text-xs font-semibold">
                  <button type="button" className="text-slate-500" onClick={() => setLegacy({ timeline: move(draft.legacy.timeline, index, -1) })}>Up</button>
                  <button type="button" className="text-slate-500" onClick={() => setLegacy({ timeline: move(draft.legacy.timeline, index, 1) })}>Down</button>
                  <button type="button" className="text-red-600" onClick={() => setLegacy({ timeline: draft.legacy.timeline.filter((item) => item.id !== entry.id) })}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "Legacy tree" && (
        <div className={card}>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={field} placeholder="Tree heading" value={draft.legacy.treeTitle} onChange={(event) => setLegacy({ treeTitle: event.target.value })} />
            <input className={field} placeholder="Tree introduction" value={draft.legacy.treeIntro} onChange={(event) => setLegacy({ treeIntro: event.target.value })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">People in the tree</p>
              <p className="text-xs text-slate-500">Choose who each person sits under. People with no parent start a new branch at the top.</p>
            </div>
            <button type="button" className="text-sm font-semibold text-burgundy" onClick={() => setLegacy({ tree: [...tree, { id: `f-${Date.now()}`, parentId: tree[0]?.id, name: "", relation: "" }] })}>+ Add person</button>
          </div>
          {tree.map((node) => {
            const blocked = descendantsOf(tree, node.id);
            const update = (patch: Partial<FamilyNode>) => setLegacy({ tree: editList(tree, node.id, patch) });
            return (
              <div key={node.id} className="grid gap-3 rounded-lg border border-slate-100 p-4 lg:grid-cols-[220px_1fr]">
                <ImageField label="Photo" value={node.photo} maxWidth={500} onChange={(photo) => update({ photo })} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={field} placeholder="Name" value={node.name} onChange={(event) => update({ name: event.target.value })} />
                  <input className={field} placeholder="Relation, e.g. Son, Disciple" value={node.relation} onChange={(event) => update({ relation: event.target.value })} />
                  <input className={field} placeholder="Years, e.g. 1940 – 2010" value={node.years ?? ""} onChange={(event) => update({ years: event.target.value })} />
                  <select className={field} value={node.parentId ?? ""} onChange={(event) => update({ parentId: event.target.value || undefined })}>
                    <option value="">Top of the tree</option>
                    {tree.filter((other) => !blocked.has(other.id)).map((other) => (
                      <option key={other.id} value={other.id}>Under {other.name || "(unnamed)"}</option>
                    ))}
                  </select>
                  <textarea className={`${field} sm:col-span-2`} rows={2} placeholder="Short note" value={node.note ?? ""} onChange={(event) => update({ note: event.target.value })} />
                  <button
                    type="button"
                    className="justify-self-start text-xs font-semibold text-red-600"
                    onClick={() => setLegacy({ tree: tree.filter((item) => item.id !== node.id).map((item) => (item.parentId === node.id ? { ...item, parentId: node.parentId } : item)) })}
                  >
                    Remove person
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
        <button type="button" className={button} onClick={save}>Save About pages</button>
        <button
          type="button"
          className={ghost}
          onClick={() => {
            if (!window.confirm("Restore the original About content? Your edits will be removed.")) return;
            resetAbout();
            setDraft(getAbout());
            setMessage("Restored the original content.");
          }}
        >
          Restore original
        </button>
        {message && <p className="text-sm text-slate-700">{message}</p>}
      </div>
    </div>
  );
}
