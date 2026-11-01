"use client";

import { useMemo, useState } from "react";
import { englishMessages, type MessageKey } from "@/lib/i18n/messages";
import { publishLiveSite } from "@/lib/mobile-publish";
import {
  defaultReviewsControls,
  getSiteText,
  homeSections,
  normalizeSiteText,
  saveSiteText,
  type HomeSectionId,
  type PageCopy,
  type ReviewsTheme,
  type SiteText,
} from "@/lib/site-text";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const button = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";
const ghost = "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50";
const card = "space-y-4 rounded-xl border border-slate-200 bg-white p-5";

const groupLabels: Record<string, string> = {
  nav: "Header menu",
  header: "Header",
  footer: "Footer",
  home: "Homepage sections",
  hero: "Homepage hero",
  common: "Common buttons & labels",
  article: "Articles",
  events: "Events",
  gallery: "Gallery",
  chat: "Chat widget",
  notice: "Notices",
  clinic: "Clinics",
  about: "About Us",
  contact: "Contact page",
  shop: "Shop",
  videos: "Videos",
  login: "Sign in",
  legal: "Policies",
  announce: "Announcements",
  support: "Support Us",
  legacy: "Legacy",
  lang: "Language",
};

const headerPages: { path: string; label: string }[] = [
  { path: "/about", label: "About Us" },
  { path: "/about/foundation", label: "About · Foundation" },
  { path: "/about/history", label: "About · History" },
  { path: "/about/trustees", label: "About · Trustees" },
  { path: "/about/awards", label: "About · Awards" },
  { path: "/about/books-and-research", label: "About · Books & research" },
  { path: "/about/legacy-of-vaidya-rb-gogate", label: "About · Legacy" },
  { path: "/about/dr-anagha-gogate", label: "About · Dr. Anagha Gogate" },
  { path: "/events", label: "Events" },
  { path: "/notices", label: "Notices" },
  { path: "/announcements", label: "Announcements" },
  { path: "/gallery", label: "Gallery" },
  { path: "/videos", label: "Videos" },
  { path: "/articles", label: "Articles" },
  { path: "/shop", label: "Shop" },
  { path: "/cart", label: "Cart" },
  { path: "/checkout", label: "Checkout" },
  { path: "/clinics", label: "Clinics" },
  { path: "/contact", label: "Contact" },
  { path: "/certificate-verification", label: "Certificate verification" },
  { path: "/privacy", label: "Privacy policy" },
  { path: "/refund-policy", label: "Refund policy" },
  { path: "/support", label: "Support" },
  { path: "/application-status", label: "Application status" },
  { path: "/terms", label: "Terms" },
  { path: "/return-policy", label: "Return policy" },
  { path: "/shipping-policy", label: "Shipping policy" },
  { path: "/cancellation-policy", label: "Cancellation policy" },
];

const allKeys = Object.keys(englishMessages) as MessageKey[];

function groupOf(key: string) {
  return key.split(".")[0];
}

type Tab = "home" | "reviews" | "pages" | "text";

export function SiteTextDesk() {
  const [draft, setDraft] = useState<SiteText>(() => getSiteText());
  const [tab, setTab] = useState<Tab>("home");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (next = draft) => {
    setBusy(true);
    saveSiteText(next);
    setDraft(normalizeSiteText(next));
    const result = await publishLiveSite();
    setBusy(false);
    setNote(result.ok ? "Saved and published to the live website." : "Saved in this browser. Publishing did not complete; it will retry on the next save.");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Site text & controls</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Change any heading, label, button or paragraph on the public website, reorder or hide homepage sections, and set how the Seminar voices slider looks. Leave a field blank to use the default wording.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["home", "Homepage sections"],
            ["reviews", "Seminar voices"],
            ["pages", "Page headings"],
            ["text", "All site text"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === id ? "bg-blue-800 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "home" && <HomePanel draft={draft} setDraft={setDraft} />}
      {tab === "reviews" && <ReviewsPanel draft={draft} setDraft={setDraft} />}
      {tab === "pages" && <PagesPanel draft={draft} setDraft={setDraft} />}
      {tab === "text" && <TextPanel draft={draft} setDraft={setDraft} />}

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
        <button type="button" className={button} disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save & publish"}
        </button>
        <button
          type="button"
          className={ghost}
          onClick={() => {
            setDraft(getSiteText());
            setNote("Unsaved changes discarded.");
          }}
        >
          Discard changes
        </button>
        {note && <p className="text-sm text-emerald-700">{note}</p>}
      </div>
    </div>
  );
}

type PanelProps = { draft: SiteText; setDraft: (update: (current: SiteText) => SiteText) => void };

function HomePanel({ draft, setDraft }: PanelProps) {
  const move = (id: HomeSectionId, delta: number) =>
    setDraft((current) => {
      const order = [...current.homeOrder];
      const from = order.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= order.length) return current;
      [order[from], order[to]] = [order[to], order[from]];
      return { ...current, homeOrder: order };
    });
  return (
    <section className={card}>
      <div>
        <h2 className="font-semibold text-slate-900">Homepage sections</h2>
        <p className="mt-1 text-sm text-slate-500">Untick to hide a section. Use the arrows to change the order on vaidyagogate.org.</p>
      </div>
      <ol className="space-y-2">
        {draft.homeOrder.map((id, position) => {
          const label = homeSections.find((section) => section.id === id)?.label ?? id;
          const shown = !draft.homeHidden[id];
          return (
            <li key={id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <span className="w-6 text-xs font-semibold text-slate-400">{position + 1}</span>
              <label className="flex flex-1 items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={(event) => setDraft((current) => ({ ...current, homeHidden: { ...current.homeHidden, [id]: !event.target.checked } }))}
                />
                {label}
              </label>
              <button type="button" className={ghost} disabled={position === 0} onClick={() => move(id, -1)} aria-label={`Move ${label} up`}>
                ↑
              </button>
              <button type="button" className={ghost} disabled={position === draft.homeOrder.length - 1} onClick={() => move(id, 1)} aria-label={`Move ${label} down`}>
                ↓
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ReviewsPanel({ draft, setDraft }: PanelProps) {
  const controls = draft.reviews;
  const set = (patch: Partial<SiteText["reviews"]>) => setDraft((current) => ({ ...current, reviews: { ...current.reviews, ...patch } }));
  const toggles: { key: "showStars" | "showEvent" | "showPhoto" | "showArrows" | "showDots"; label: string }[] = [
    { key: "showStars", label: "Show star rating" },
    { key: "showEvent", label: "Show seminar / event name" },
    { key: "showPhoto", label: "Show participant photo (when added)" },
    { key: "showArrows", label: "Show previous / next arrows" },
    { key: "showDots", label: "Show slide dots" },
  ];
  return (
    <section className={card}>
      <div>
        <h2 className="font-semibold text-slate-900">Seminar voices slider</h2>
        <p className="mt-1 text-sm text-slate-500">Reviews themselves are managed under Website → Reviews. Headings are in the text fields below.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Background</span>
          <select className={field} value={controls.theme} onChange={(event) => set({ theme: event.target.value as ReviewsTheme })}>
            <option value="white">White (matches homepage)</option>
            <option value="paper">Cream paper</option>
            <option value="navy">Navy</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Auto-advance every (seconds, 0 = off)</span>
          <input
            type="number"
            min={0}
            max={60}
            className={field}
            value={controls.autoplaySeconds}
            onChange={(event) => set({ autoplaySeconds: Number(event.target.value) })}
          />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {toggles.map((item) => (
          <label key={item.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800">
            <input type="checkbox" checked={controls[item.key]} onChange={(event) => set({ [item.key]: event.target.checked })} />
            {item.label}
          </label>
        ))}
      </div>
      <div className="space-y-3">
        {(["home.reviewsEyebrow", "home.reviewsTitle", "home.reviewsDesc"] as MessageKey[]).map((key) => (
          <TextRow key={key} messageKey={key} draft={draft} setDraft={setDraft} />
        ))}
      </div>
      <button type="button" className={ghost} onClick={() => set({ ...defaultReviewsControls })}>
        Reset slider controls
      </button>
    </section>
  );
}

function PagesPanel({ draft, setDraft }: PanelProps) {
  const [extra, setExtra] = useState("");
  const paths = useMemo(() => {
    const known = new Set(headerPages.map((page) => page.path));
    const custom = Object.keys(draft.pages)
      .filter((path) => !known.has(path))
      .map((path) => ({ path, label: path }));
    return [...headerPages, ...custom];
  }, [draft.pages]);
  const set = (path: string, patch: PageCopy) =>
    setDraft((current) => ({ ...current, pages: { ...current.pages, [path]: { ...current.pages[path], ...patch } } }));

  return (
    <section className={card}>
      <div>
        <h2 className="font-semibold text-slate-900">Page headings</h2>
        <p className="mt-1 text-sm text-slate-500">The small label, title and intro at the top of each page. Blank fields keep the current wording.</p>
      </div>
      <div className="space-y-3">
        {paths.map((page) => {
          const copy = draft.pages[page.path] ?? {};
          return (
            <details key={page.path} className="rounded-lg border border-slate-200 px-3 py-2" open={Boolean(copy.title || copy.eyebrow || copy.description)}>
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                {page.label} <span className="font-normal text-slate-400">{page.path}</span>
              </summary>
              <div className="mt-3 grid gap-2">
                <input className={field} placeholder="Small label above the title" value={copy.eyebrow ?? ""} onChange={(event) => set(page.path, { eyebrow: event.target.value })} />
                <input className={field} placeholder="Page title" value={copy.title ?? ""} onChange={(event) => set(page.path, { title: event.target.value })} />
                <textarea className={field} rows={2} placeholder="Intro paragraph" value={copy.description ?? ""} onChange={(event) => set(page.path, { description: event.target.value })} />
              </div>
            </details>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <input className={`${field} max-w-xs`} placeholder="/another-page" value={extra} onChange={(event) => setExtra(event.target.value)} />
        <button
          type="button"
          className={ghost}
          onClick={() => {
            const path = `/${extra.trim().replace(/^\/+|\/+$/g, "")}`;
            if (path.length > 1) set(path, {});
            setExtra("");
          }}
        >
          Add page
        </button>
      </div>
    </section>
  );
}

function TextPanel({ draft, setDraft }: PanelProps) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const groups = useMemo(() => [...new Set(allKeys.map(groupOf))], []);
  const needle = query.trim().toLowerCase();
  const rows = allKeys.filter((key) => {
    if (group !== "all" && groupOf(key) !== group) return false;
    if (onlyChanged && !draft.text[key]) return false;
    if (!needle) return true;
    return key.toLowerCase().includes(needle) || englishMessages[key].toLowerCase().includes(needle) || (draft.text[key] ?? "").toLowerCase().includes(needle);
  });
  const changed = Object.keys(draft.text).length;

  return (
    <section className={card}>
      <div>
        <h2 className="font-semibold text-slate-900">All site text</h2>
        <p className="mt-1 text-sm text-slate-500">
          {allKeys.length} labels across the header, footer, homepage and pages. {changed} customised.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]">
        <input className={field} placeholder="Search wording, e.g. Seminar voices" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className={field} value={group} onChange={(event) => setGroup(event.target.value)}>
          <option value="all">All areas</option>
          {groups.map((id) => (
            <option key={id} value={id}>
              {groupLabels[id] ?? id}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={onlyChanged} onChange={(event) => setOnlyChanged(event.target.checked)} />
          Customised only
        </label>
      </div>
      <div className="space-y-3">
        {rows.map((key) => (
          <TextRow key={key} messageKey={key} draft={draft} setDraft={setDraft} showGroup />
        ))}
        {!rows.length && <p className="text-sm text-slate-500">Nothing matches that search.</p>}
      </div>
    </section>
  );
}

function TextRow({ messageKey, draft, setDraft, showGroup }: PanelProps & { messageKey: MessageKey; showGroup?: boolean }) {
  const fallback = englishMessages[messageKey];
  const value = draft.text[messageKey] ?? "";
  const long = fallback.length > 70;
  const update = (next: string) =>
    setDraft((current) => {
      const text = { ...current.text };
      if (next) text[messageKey] = next;
      else delete text[messageKey];
      return { ...current, text };
    });
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {showGroup ? <span className="font-semibold text-slate-700">{groupLabels[groupOf(messageKey)] ?? groupOf(messageKey)} · </span> : null}
          Default: {fallback}
        </span>
        {value ? (
          <button type="button" className="font-semibold text-burgundy hover:underline" onClick={() => update("")}>
            Reset
          </button>
        ) : null}
      </div>
      {long ? (
        <textarea className={field} rows={2} placeholder={fallback} value={value} onChange={(event) => update(event.target.value)} />
      ) : (
        <input className={field} placeholder={fallback} value={value} onChange={(event) => update(event.target.value)} />
      )}
    </div>
  );
}
