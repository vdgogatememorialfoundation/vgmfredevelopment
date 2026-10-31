"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyCertificate } from "@/lib/certificates-client";
import { AccountsSection } from "@/components/admin/AdminAccounts";
import {
  blankEvent,
  canEdit,
  contentModules,
  deleteEvent,
  editorsFor,
  getArticle,
  getArticleAssignments,
  getLiveEvents,
  getModuleAccess,
  getSiteFlags,
  hideAnnouncement,
  hideArticle,
  removeArticleAssignment,
  saveAnnouncement,
  saveArticle,
  saveArticleAssignment,
  saveEvent,
  saveModuleAccess,
  saveSiteFlags,
  slugify,
  type ContentModuleId,
  type SiteFlags,
} from "@/lib/cms";
import { partnerSites } from "@/lib/partner-keys";
import {
  ensureBootstrapped,
  getAccounts,
  getOutbox,
  getSettings,
  refundOrder,
  saveSettings,
  sendEmail,
  setOrderStatus,
} from "@/lib/admin-store";
import { getOrders } from "@/lib/store";
import { useAllArticles, useLiveAnnouncements, useLiveEvents } from "@/lib/use-cms";
import type { Announcement, Article, ArticleAssignment, ArticleLocaleCopy, ArticleStatus, CaptionedImage, Event, EventTbd, Order, Speaker } from "@/types";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { ShareBar } from "@/components/common/ShareBar";
import { articlePublicUrl, articleShareText } from "@/lib/article-display";
import { getSession } from "@/lib/auth";
import { displayName } from "@/lib/admin-store";
import { GalleryField, ImageField } from "@/components/admin/ImageField";
import { EventLocationField } from "@/components/events/EventLocationField";
import type { OrderStatus } from "@/lib/admin-store";
import { fromDatetimeLocal, toDatetimeLocal } from "@/lib/schedule";

ensureBootstrapped();

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const button = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white";
const ghost = "rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700";

function EditorGate({
  moduleId,
  email,
  onEmail,
}: {
  moduleId: ContentModuleId;
  email: string;
  onEmail: (value: string) => void;
}) {
  const allowed = canEdit(moduleId, email);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Editing as
      </label>
      <input className={`${field} mt-2`} value={email} onChange={(event) => onEmail(event.target.value)} />
      <p className="mt-2 text-xs text-slate-500">
        {allowed
          ? "This address can publish in this module."
          : `Give this account a staff role with this module, or sign in as ${editorsFor(moduleId)[0]}.`}
      </p>
    </div>
  );
}

function emptyLocaleCopy(): ArticleLocaleCopy {
  return { title: "", excerpt: "", content: "" };
}

export function ArticleEditor({ articleId }: { articleId?: string | null }) {
  const assignId = useSearchParams().get("assign");
  const assignment = assignId ? getArticleAssignments().find((item) => item.id === assignId) : undefined;
  const existing = articleId ? getArticle(articleId) : undefined;
  const session = getSession();
  const isAdmin = session?.role === "admin";
  const [email, setEmail] = useState(() => session?.email ?? "admin@vaidyagogate.org");
  const [title, setTitle] = useState(existing?.title ?? assignment?.title ?? "");
  const [excerpt, setExcerpt] = useState(existing?.excerpt ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [author, setAuthor] = useState(existing?.author ?? (session ? displayName(session) : ""));
  const [category, setCategory] = useState(existing?.category ?? "Ayurveda");
  const [tags, setTags] = useState((existing?.tags ?? []).join(", "));
  const [coverImage, setCoverImage] = useState(existing?.coverImage ?? "");
  const [images, setImages] = useState<CaptionedImage[]>(existing?.images ?? []);
  const [featured, setFeatured] = useState(Boolean(existing?.featured));
  const [assignedTo, setAssignedTo] = useState(existing?.assignedTo ?? assignment?.assignedTo ?? session?.email ?? "");
  const [translations, setTranslations] = useState<Record<string, ArticleLocaleCopy>>(existing?.translations ?? {});
  const [localeEdit, setLocaleEdit] = useState<Locale>("en");
  const [saved, setSaved] = useState("");
  const [status, setStatus] = useState<ArticleStatus | "">(existing?.status ?? "");
  const [reviewNote, setReviewNote] = useState(existing?.reviewNote ?? "");
  const [error, setError] = useState("");
  const staff = getAccounts().filter((account) => account.role === "staff" || account.role === "admin");

  const insertImage = (index: number) =>
    setContent((current) => `${current.trimEnd()}${current.trim() ? "\n\n" : ""}[[image:${index + 1}]]\n\n`);

  const translation = translations[localeEdit] ?? emptyLocaleCopy();
  const setTranslation = (patch: ArticleLocaleCopy) =>
    setTranslations((current) => ({ ...current, [localeEdit]: { ...(current[localeEdit] ?? emptyLocaleCopy()), ...patch } }));

  const persist = (nextStatus: ArticleStatus) => {
    if (!title.trim() || !content.trim()) {
      setError("Add a title and the article text, then save.");
      return;
    }
    if (!canEdit("articles", email)) {
      setError("This account cannot save articles. Give its staff role the Articles module, or use an admin account.");
      return;
    }
    setError("");
    const words = content.trim().split(/\s+/).length;
    const article: Article = {
      id: existing?.id ?? `art-${Date.now()}`,
      title: title.trim(),
      slug: existing?.slug ?? slugify(title),
      excerpt: excerpt.trim() || content.replace(/\[\[image:\d+\]\]/g, "").trim().slice(0, 160),
      content: content.trim(),
      author: (session ? displayName(session) : author.trim()) || "VGMF",
      publishedByEmail: session?.email || email.trim() || undefined,
      category: category.trim() || "Ayurveda",
      date: existing?.date ?? new Date().toISOString().slice(0, 10),
      featured,
      coverImage: coverImage || undefined,
      images: images.filter((image) => image.src),
      readingTime: `${Math.max(1, Math.round(words / 200))} min`,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      status: nextStatus,
      assignedTo: assignedTo || undefined,
      reviewNote: nextStatus === "published" ? undefined : reviewNote || existing?.reviewNote,
      translations,
    };
    if (!article.tags?.length) article.tags = [article.category];
    try {
      saveArticle(article);
      const linked = getArticleAssignments().find((item) => item.id === assignId || item.articleId === article.id || (item.title === article.title && item.assignedTo === (session?.email ?? "")));
      if (linked) {
        saveArticleAssignment({
          ...linked,
          articleId: article.id,
          status: nextStatus === "published" ? "done" : nextStatus === "pending" ? "submitted" : "writing",
        });
      }
      setStatus(nextStatus);
      setSaved(article.slug);
    } catch {
      setError("The browser storage is full. Use smaller images or image URLs instead of uploads.");
    }
  };

  const staffSaveStatus: ArticleStatus = existing?.status === "published" ? "published" : "pending";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{existing ? "Edit article" : "Create article"}</h1>
        <Link href="/admin/articles" className={ghost}>Back to articles</Link>
      </div>
      <EditorGate moduleId="articles" email={email} onEmail={setEmail} />
      {!isAdmin && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Staff articles go to admin for review before they appear on the public site. You can keep editing at any time.
        </p>
      )}
      {(status === "rejected" || existing?.status === "rejected") && (reviewNote || existing?.reviewNote) && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Returned for changes: {reviewNote || existing?.reviewNote}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            {LOCALES.map((locale) => (
              <button
                key={locale.id}
                type="button"
                onClick={() => setLocaleEdit(locale.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${localeEdit === locale.id ? "bg-ink text-white" : "border border-slate-200 text-slate-600"}`}
              >
                {locale.native}
              </button>
            ))}
          </div>
          {localeEdit === "en" ? (
            <>
              <input className={field} placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
              <textarea className={field} rows={3} placeholder="Excerpt shown on article cards" value={excerpt} onChange={(event) => setExcerpt(event.target.value)} />
              <textarea className={`${field} font-mono`} rows={14} placeholder="Article body. Leave a blank line between paragraphs." value={content} onChange={(event) => setContent(event.target.value)} />
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500">Translation for {LOCALES.find((item) => item.id === localeEdit)?.name}. Leave a field empty to keep the original English.</p>
              <input className={field} placeholder="Translated title" value={translation.title ?? ""} onChange={(event) => setTranslation({ title: event.target.value })} />
              <textarea className={field} rows={3} placeholder="Translated excerpt" value={translation.excerpt ?? ""} onChange={(event) => setTranslation({ excerpt: event.target.value })} />
              <textarea className={`${field} font-mono`} rows={14} placeholder="Translated body" value={translation.content ?? ""} onChange={(event) => setTranslation({ content: event.target.value })} />
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className={field}
              placeholder="Published by (account name)"
              value={session ? displayName(session) : author}
              onChange={(event) => setAuthor(event.target.value)}
              readOnly={Boolean(session)}
              title="Articles show the signed-in account name as publisher."
            />
            <input className={field} placeholder="Category" value={category} onChange={(event) => setCategory(event.target.value)} />
          </div>
          <input className={field} placeholder="Tags, separated by commas" value={tags} onChange={(event) => setTags(event.target.value)} />
          <p className="text-xs text-slate-500">
            Start a line with <code>## </code> for a sub-heading. <code>[[image:2]]</code> on its own line places gallery image 2 inside the article;
            images not placed in the text are shown as a gallery at the end.
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />
            Feature on the homepage and at the top of Articles
          </label>
          {isAdmin && (
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Assigned writer
              <select className={`${field} mt-1`} value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                <option value="">Unassigned</option>
                {staff.map((account) => (
                  <option key={account.email} value={account.email}>{displayName(account)} · {account.email}</option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <>
                <button type="button" className={ghost} onClick={() => persist("draft")}>Save draft</button>
                <button type="button" className={button} onClick={() => persist("published")}>Approve and publish</button>
              </>
            ) : (
              <button type="button" className={button} onClick={() => persist(staffSaveStatus)}>
                {staffSaveStatus === "published" ? "Save changes" : "Save for admin review"}
              </button>
            )}
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {saved && (
            <p className="text-sm text-emerald-700">
              {status === "published" ? (
                <>Published. <Link className="underline" href={`/articles/${saved}`}>View on the site</Link></>
              ) : status === "pending" ? (
                "Saved. An administrator must approve it before it goes live."
              ) : (
                "Draft saved."
              )}
            </p>
          )}
          {existing && (
            <div className="border-t border-slate-100 pt-4">
              <ShareBar url={articlePublicUrl(existing)} title={title || existing.title} text={articleShareText({ ...existing, title: title || existing.title, excerpt: excerpt || existing.excerpt })} />
            </div>
          )}
        </div>
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          <ImageField label="Cover image" value={coverImage} onChange={setCoverImage} hint="Shown on the article card and at the top of the article." />
          <GalleryField label="Article images" images={images} onChange={setImages} />
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((_, index) => (
                <button key={index} type="button" className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700" onClick={() => insertImage(index)}>
                  Insert image {index + 1} in text
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const statusLabel: Record<ArticleStatus, string> = {
  draft: "Draft",
  pending: "Awaiting approval",
  published: "Live",
  rejected: "Returned",
};

export function ArticleAdmin() {
  const articles = useAllArticles();
  const session = getSession();
  const isAdmin = session?.role === "admin";
  const [assignments, setAssignments] = useState(() => getArticleAssignments());
  const [brief, setBrief] = useState({ title: "", notes: "", assignedTo: "", dueDate: "" });
  const [shareId, setShareId] = useState<string | null>(null);
  const staff = getAccounts().filter((account) => account.role === "staff");
  const refreshAssignments = () => setAssignments(getArticleAssignments());

  const assign = () => {
    if (!brief.title.trim() || !brief.assignedTo) return;
    saveArticleAssignment({
      id: `asg-${Date.now()}`,
      title: brief.title.trim(),
      brief: brief.notes.trim(),
      assignedTo: brief.assignedTo,
      assignedBy: session?.email ?? "admin@vaidyagogate.org",
      dueDate: brief.dueDate || undefined,
      status: "assigned",
      createdAt: new Date().toISOString(),
    });
    setBrief({ title: "", notes: "", assignedTo: "", dueDate: "" });
    refreshAssignments();
  };

  const mine = session?.role === "staff" ? assignments.filter((item) => item.assignedTo.toLowerCase() === session.email.toLowerCase()) : assignments;
  const listed =
    session?.role === "staff"
      ? articles.filter(
          (article) =>
            article.publishedByEmail?.toLowerCase() === session.email.toLowerCase() ||
            article.assignedTo?.toLowerCase() === session.email.toLowerCase()
        )
      : articles;
  const sharing = listed.find((article) => article.id === shareId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Articles</h1>
          <p className="mt-1 text-sm text-slate-500">Staff drafts wait for admin approval. Share a live article to social networks or copy its link.</p>
        </div>
        <Link href="/admin/articles/new" className={button}>+ Create article</Link>
      </div>

      {isAdmin && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <p className="font-semibold text-slate-900">Assign an article to write</p>
          <div className="grid gap-3 md:grid-cols-2">
            <input className={field} placeholder="Working title" value={brief.title} onChange={(event) => setBrief({ ...brief, title: event.target.value })} />
            <select className={field} value={brief.assignedTo} onChange={(event) => setBrief({ ...brief, assignedTo: event.target.value })}>
              <option value="">Choose staff</option>
              {staff.map((account) => (
                <option key={account.email} value={account.email}>{displayName(account)} · {account.email}</option>
              ))}
            </select>
            <input className={field} type="date" value={brief.dueDate} onChange={(event) => setBrief({ ...brief, dueDate: event.target.value })} />
            <textarea className={`${field} md:col-span-2`} rows={2} placeholder="Brief for the writer" value={brief.notes} onChange={(event) => setBrief({ ...brief, notes: event.target.value })} />
          </div>
          <button type="button" className={button} onClick={assign} disabled={!brief.title.trim() || !brief.assignedTo}>Assign</button>
        </div>
      )}

      {mine.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <p className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">Writing assignments</p>
          <ul>
            {mine.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    {item.status} · {item.assignedTo}{item.dueDate ? ` · due ${item.dueDate}` : ""}
                  </p>
                  {item.brief ? <p className="mt-1 text-sm text-slate-600">{item.brief}</p> : null}
                </div>
                <div className="flex flex-wrap gap-3 text-sm font-semibold">
                  <Link className="text-burgundy" href={item.articleId ? `/admin/articles/new?id=${item.articleId}` : `/admin/articles/new?assign=${item.id}`}>
                    {item.articleId ? "Open draft" : "Start writing"}
                  </Link>
                  {isAdmin && (
                    <button type="button" className="text-red-600" onClick={() => { removeArticleAssignment(item.id); refreshAssignments(); }}>
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <ul className="min-w-[36rem]">
          {listed.map((article) => (
            <li key={article.id} className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{article.title}</p>
                <p className="text-xs text-slate-500">
                  {statusLabel[article.status ?? "published"]} · {article.category} · Published by {article.author || "VGMF"}
                  {article.assignedTo ? ` · Writer ${article.assignedTo}` : ""}
                  {article.reviewNote && (article.status === "rejected" || article.status === "pending") ? ` · Note: ${article.reviewNote}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm font-semibold">
                <Link className="text-burgundy" href={`/admin/articles/new?id=${article.id}`}>Edit</Link>
                {(article.status ?? "published") === "published" && (
                  <>
                    <Link className="text-slate-500" href={`/articles/${article.slug}`}>View</Link>
                    <button type="button" className="text-ink" onClick={() => setShareId(article.id === shareId ? null : article.id)}>Share</button>
                  </>
                )}
                {isAdmin && (article.status ?? "published") !== "published" && (
                  <>
                    <button
                      type="button"
                      className="text-emerald-700"
                      onClick={() => {
                        saveArticle({ ...article, status: "published", reviewNote: undefined });
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="text-amber-800"
                      onClick={() => {
                        const note = window.prompt("Note for the writer (optional)", article.reviewNote ?? "") ?? "";
                        saveArticle({ ...article, status: "rejected", reviewNote: note.trim() || undefined });
                      }}
                    >
                      Return
                    </button>
                  </>
                )}
                <button type="button" className="text-red-600" onClick={() => { if (window.confirm(`Delete the article “${article.title}”?`)) hideArticle(article.id); }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {sharing && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-slate-900">Share “{sharing.title}”</p>
          <ShareBar url={articlePublicUrl(sharing)} title={sharing.title} text={articleShareText(sharing)} />
        </div>
      )}
    </div>
  );
}

export function AnnouncementAdmin() {
  const items = useLiveAnnouncements();
  const params = useSearchParams();
  const current = items.find((item) => item.id === params.get("id"));
  return <AnnouncementForm key={current?.id ?? "new"} current={current} items={items} />;
}

function AnnouncementForm({
  current,
  items,
}: {
  current?: Announcement;
  items: Announcement[];
}) {
  const [email, setEmail] = useState(() => getSession()?.email ?? "admin@vaidyagogate.org");
  const [title, setTitle] = useState(current?.title ?? "");
  const [description, setDescription] = useState(current?.description ?? "");
  const [href, setHref] = useState(current?.href ?? "/announcements");
  const [category, setCategory] = useState(current?.category ?? "News");
  const [priority, setPriority] = useState<"high" | "normal">(current?.priority ?? "high");
  const [publishAt, setPublishAt] = useState(toDatetimeLocal(current?.publishAt));
  const [unpublishAt, setUnpublishAt] = useState(toDatetimeLocal(current?.unpublishAt));
  const [saved, setSaved] = useState(false);

  const publish = () => {
    if (!canEdit("announcements", email) || !title.trim()) return;
    const item: Announcement = {
      id: current?.id ?? `ann-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      date: current?.date ?? new Date().toISOString().slice(0, 10),
      category,
      href: href.trim() || "/announcements",
      priority,
      publishAt: fromDatetimeLocal(publishAt),
      unpublishAt: fromDatetimeLocal(unpublishAt),
    };
    saveAnnouncement(item);
    setSaved(true);
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
      <EditorGate moduleId="announcements" email={email} onEmail={setEmail} />
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <input className={field} placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <textarea className={field} rows={3} placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
        <input className={field} placeholder="Link" value={href} onChange={(event) => setHref(event.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={field} value={category} onChange={(event) => setCategory(event.target.value)} />
          <select className={field} value={priority} onChange={(event) => setPriority(event.target.value as "high" | "normal")}>
            <option value="high">Show in ticker</option>
            <option value="normal">Lower priority</option>
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Go live (leave empty to publish now)
            <input className={`${field} mt-1`} type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Hide after (optional)
            <input className={`${field} mt-1`} type="datetime-local" value={unpublishAt} onChange={(event) => setUnpublishAt(event.target.value)} />
          </label>
        </div>
        <button type="button" className={button} onClick={publish}>{current ? "Update announcement" : "Publish announcement"}</button>
        {saved && <p className="text-sm text-emerald-700">Saved. It appears in the site ticker as soon as it is live.</p>}
      </div>
      <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0">
            <div>
              <p className="font-semibold text-slate-900">{item.title}</p>
              <p className="text-xs text-slate-500">{item.priority} · {item.category}</p>
            </div>
            <div className="flex gap-3 text-sm font-semibold">
              <Link className="text-burgundy" href={`/admin/website/announcements?id=${item.id}`}>Edit</Link>
              <button type="button" className="text-red-600" onClick={() => { if (window.confirm(`Delete the announcement “${item.title}”?`)) hideAnnouncement(item.id); }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const tbdFields: { key: keyof EventTbd; label: string }[] = [
  { key: "dates", label: "Dates" },
  { key: "fee", label: "Price" },
  { key: "speakers", label: "Speakers" },
  { key: "registration", label: "Registration link" },
];

export function EventEditor({ eventId }: { eventId?: string | null }) {
  const existing = eventId ? getLiveEvents().find((event) => event.id === eventId) : undefined;
  const [email, setEmail] = useState(() => getSession()?.email ?? "admin@vaidyagogate.org");
  const [draft, setDraft] = useState<Event>(existing ?? blankEvent(""));
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  const set = (patch: Partial<Event>) => setDraft((current) => ({ ...current, ...patch }));
  const tbd = draft.tbd ?? {};
  const toggleTbd = (key: keyof EventTbd, value: boolean) => set({ tbd: { ...tbd, [key]: value } });
  const speakers = draft.speakers ?? [];
  const setSpeaker = (index: number, patch: Partial<Speaker>) =>
    set({ speakers: speakers.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  const publish = () => {
    if (!draft.name.trim()) {
      setError("Add the event name.");
      return;
    }
    if (!canEdit("events", email)) {
      setError("This account cannot publish events. Give its staff role the Events module.");
      return;
    }
    if (!tbd.dates && !draft.startDate) {
      setError("Pick a start date, or tick Dates as to be announced.");
      return;
    }
    setError("");
    const event: Event = {
      ...draft,
      slug: draft.slug || slugify(draft.name),
      name: draft.name.trim(),
      endDate: draft.endDate || draft.startDate,
      speakers: speakers.filter((item) => item.name.trim()),
    };
    try {
      saveEvent(event);
      setSaved(event.slug);
    } catch {
      setError("The browser storage is full. Use a smaller banner or an image URL.");
    }
  };

  const tbdNote = (key: keyof EventTbd) =>
    tbd[key] ? <span className="text-[11px] font-semibold uppercase text-amber-700">Shown as “To be announced”</span> : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{existing ? "Edit event" : "Create event"}</h1>
        <Link href="/admin/events" className={ghost}>All events</Link>
      </div>
      <EditorGate moduleId="events" email={email} onEmail={setEmail} />
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Not finalised yet?</p>
        <p className="mt-1 text-xs text-amber-800">Tick anything still being decided. The site shows it as “To be announced” until you add it later.</p>
        <div className="mt-3 flex flex-wrap gap-4">
          {tbdFields.map((item) => (
            <label key={item.key} className="flex items-center gap-2 text-sm text-amber-900">
              <input type="checkbox" checked={Boolean(tbd[item.key])} onChange={(event) => toggleTbd(item.key, event.target.checked)} />
              {item.label} TBD
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <input className={`${field} sm:col-span-2`} placeholder="Event name" value={draft.name} onChange={(event) => set({ name: event.target.value, slug: existing ? draft.slug : slugify(event.target.value) })} />
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Event type
          <select className={field} value={draft.eventType} onChange={(event) => set({ eventType: event.target.value as Event["eventType"] })}>
            <option>Seminar</option>
            <option>Conference</option>
            <option>Workshop</option>
            <option>Webinar</option>
            <option>Fellowship</option>
            <option>Training</option>
            <option>Other Foundation Events</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Mode
          <select className={field} value={draft.mode} onChange={(event) => set({ mode: event.target.value as Event["mode"] })}>
            <option>Offline</option>
            <option>Online</option>
            <option>Hybrid</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          <span className="flex justify-between">Start date {tbdNote("dates")}</span>
          <input className={field} type="date" value={draft.startDate} onChange={(event) => set({ startDate: event.target.value })} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          End date
          <input className={field} type="date" value={draft.endDate} onChange={(event) => set({ endDate: event.target.value })} />
        </label>
        <EventLocationField
          tbd={Boolean(tbd.venue)}
          venue={draft.venue}
          city={draft.city}
          mapsUrl={draft.mapsUrl}
          placeId={draft.placeId}
          lat={draft.lat}
          lng={draft.lng}
          onTbd={(value) => toggleTbd("venue", value)}
          onChange={(place) => set({ venue: place.venue, city: place.city, mapsUrl: place.mapsUrl, placeId: place.placeId, lat: place.lat, lng: place.lng })}
        />
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          <span className="flex justify-between">Price (₹) {tbdNote("fee")}</span>
          <input className={field} type="number" min={0} value={draft.fee} onChange={(event) => set({ fee: Number(event.target.value) })} disabled={Boolean(tbd.fee)} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          <span className="flex justify-between">Registration link {tbdNote("registration")}</span>
          <input
            className={field}
            placeholder="https://seminar.vaidyagogate.org/..."
            value={draft.registrationUrl ?? ""}
            disabled={Boolean(tbd.registration)}
            onChange={(event) => set({ registrationUrl: event.target.value, tbd: { ...tbd, registration: false } })}
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Registration opens
          <input className={field} type="datetime-local" value={toDatetimeLocal(draft.registrationStart)} onChange={(event) => set({ registrationStart: fromDatetimeLocal(event.target.value) ?? "" })} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Registration closes (countdown)
          <input className={field} type="datetime-local" value={toDatetimeLocal(draft.registrationEnd)} onChange={(event) => set({ registrationEnd: fromDatetimeLocal(event.target.value) ?? "" })} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Go live on the site
          <input className={field} type="datetime-local" value={toDatetimeLocal(draft.publishAt)} onChange={(event) => set({ publishAt: fromDatetimeLocal(event.target.value) })} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Hide after (optional)
          <input className={field} type="datetime-local" value={toDatetimeLocal(draft.unpublishAt)} onChange={(event) => set({ unpublishAt: fromDatetimeLocal(event.target.value) })} />
        </label>
        <p className="sm:col-span-2 text-xs text-slate-500">Leave “Go live” empty to publish immediately. The ticker, events list and registration countdown use these times.</p>
        <textarea className={`${field} sm:col-span-2`} rows={3} placeholder="Short description" value={draft.shortDescription} onChange={(event) => set({ shortDescription: event.target.value })} />
        <textarea className={`${field} sm:col-span-2`} rows={6} placeholder="Event description" value={draft.description} onChange={(event) => set({ description: event.target.value })} />
        <div className="sm:col-span-2">
          <ImageField label="Event banner" value={draft.bannerUrl} onChange={(value) => set({ bannerUrl: value })} hint="Wide image, about 1600 × 700." />
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-900">Speakers {tbdNote("speakers")}</p>
          <button type="button" className="text-sm font-semibold text-burgundy" onClick={() => set({ speakers: [...speakers, { id: `spk-${Date.now()}`, name: "", designation: "", topic: "" }] })}>+ Add speaker</button>
        </div>
        {speakers.map((speaker, index) => (
          <div key={speaker.id} className="grid gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-3">
            <input className={field} placeholder="Name" value={speaker.name} onChange={(event) => setSpeaker(index, { name: event.target.value })} />
            <input className={field} placeholder="Designation" value={speaker.designation} onChange={(event) => setSpeaker(index, { designation: event.target.value })} />
            <div className="flex gap-2">
              <input className={field} placeholder="Topic" value={speaker.topic} onChange={(event) => setSpeaker(index, { topic: event.target.value })} />
              <button type="button" className="text-xs font-semibold text-red-600" onClick={() => set({ speakers: speakers.filter((_, i) => i !== index) })}>Remove</button>
            </div>
          </div>
        ))}
        {speakers.length === 0 && <p className="text-xs text-slate-500">No speakers added. You can add them later from Events → Speakers.</p>}
      </div>
      <div>
        <button type="button" className={button} onClick={publish}>Save event</button>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {saved && (
          <p className="mt-3 text-sm text-emerald-700">
            Published. <Link className="underline" href={`/events/${saved}`}>View on the site</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function EventAdminList() {
  const events = useLiveEvents();
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/admin/events/create" className={button}>+ Create event</Link>
      </div>
      {events.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No events yet. Create one with dates, location, price, speakers and a registration link.
        </p>
      )}
      <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {events.map((event) => (
          <li key={event.id} className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900">{event.name}</p>
              <p className="text-xs text-slate-500">
                {event.tbd?.dates || !event.startDate ? "Dates TBD" : event.startDate} · {event.registrationStatus}
                {event.tbd && Object.values(event.tbd).some(Boolean) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">Has TBD items</span>}
              </p>
            </div>
            <div className="flex gap-3 text-sm font-semibold">
              <Link className="text-burgundy" href={`/admin/events/create?id=${event.id}`}>Edit</Link>
              <Link className="text-slate-500" href={`/events/${event.slug}`}>View</Link>
              <button type="button" className="text-red-600" onClick={() => { if (window.confirm(`Delete the event “${event.name}”? It is removed from the site.`)) deleteEvent(event.id); }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RefundsDesk() {
  const [orders, setOrders] = useState<Order[]>(() => getOrders());
  const refresh = () => setOrders(getOrders());

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders, changes and refunds</h1>
          <p className="mt-1 text-sm text-slate-500">Advance a status, change it, or issue a refund. New orders are created from the orders desk.</p>
        </div>
        <Link href="/admin/commerce/orders" className={button}>Create order</Link>
      </div>
      {orders.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          No store orders yet. Create one from the orders desk, or place a checkout on the shop.
        </p>
      )}
      <ul className="space-y-3">
        {orders.map((order) => (
          <li key={order.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">#{order.id}</p>
                <p className="text-xs text-slate-500">{order.status} · {order.paymentStatus} · ₹{order.total.toLocaleString("en-IN")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className={field}
                  value={order.status}
                  onChange={(event) => {
                    setOrderStatus(order.id, event.target.value as OrderStatus);
                    refresh();
                  }}
                >
                  {["Pending", "Ordered", "Processing", "Packed", "To Ship", "Shipped", "Out for Delivery", "Delivered", "Failed", "Cancelled"].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={ghost}
                  disabled={order.paymentStatus === "Refunded"}
                  onClick={() => {
                    refundOrder(order.id);
                    refresh();
                  }}
                >
                  {order.paymentStatus === "Refunded" ? "Refunded" : "Issue refund"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StaffDesk() {
  return <AccountsSection fixedRole="staff" />;
}

export { CustomerDesk } from "@/components/admin/CustomerDesk";

export function ModuleAccessDesk() {
  const staff = getAccounts().filter((account) => account.role === "staff" || account.role === "admin");
  const [access, setAccess] = useState(() => getModuleAccess());
  const [saved, setSaved] = useState(false);

  const toggle = (moduleId: ContentModuleId, email: string) => {
    const current = access[moduleId] ?? [];
    const next = current.some((item) => item.toLowerCase() === email.toLowerCase())
      ? current.filter((item) => item.toLowerCase() !== email.toLowerCase())
      : [...current, email];
    setAccess({ ...access, [moduleId]: next });
    setSaved(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Extra publishing access</h1>
        <p className="mt-1 text-sm text-slate-500">Staff already get the modules of their role. Tick a staff address here to let them publish in a module outside their role as well.</p>
      </div>
      {staff.length === 0 && (
        <p className="text-sm text-slate-500">Create a staff account first, then assign modules here.</p>
      )}
      <div className="space-y-4">
        {contentModules.map((moduleItem) => (
          <section key={moduleItem.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-900">{moduleItem.label}</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {staff.map((account) => (
                <label key={account.email} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={(access[moduleItem.id] ?? []).some((email) => email.toLowerCase() === account.email.toLowerCase())}
                    onChange={() => toggle(moduleItem.id, account.email)}
                  />
                  {account.firstName} {account.lastName} ({account.email})
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
      <button
        type="button"
        className={button}
        onClick={() => {
          saveModuleAccess(access);
          setSaved(true);
        }}
      >
        Save access
      </button>
      {saved && <p className="text-sm text-emerald-700">Staff can now use the modules you ticked.</p>}
    </div>
  );
}

export function SupportUsDesk() {
  const [flags, setFlags] = useState<SiteFlags>(() => getSiteFlags());
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-slate-900">Support Us</h2>
      <p className="text-sm text-slate-500">The public site hides this block until you enable it.</p>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input
          type="checkbox"
          checked={flags.supportUs}
          onChange={(event) => setFlags({ ...flags, supportUs: event.target.checked })}
        />
        Show Support Us on the homepage
      </label>
      <input className={field} value={flags.supportUsTitle} onChange={(event) => setFlags({ ...flags, supportUsTitle: event.target.value })} />
      <textarea className={field} rows={3} value={flags.supportUsText} onChange={(event) => setFlags({ ...flags, supportUsText: event.target.value })} />
      <input className={field} value={flags.supportUsHref} onChange={(event) => setFlags({ ...flags, supportUsHref: event.target.value })} />
      <button
        type="button"
        className={button}
        onClick={() => {
          saveSiteFlags(flags);
          setSaved(true);
        }}
      >
        Save Support Us
      </button>
      {saved && <p className="text-sm text-emerald-700">{flags.supportUs ? "Support Us is live on the homepage." : "Support Us is hidden on the homepage."}</p>}
    </div>
  );
}

export function CertificateApiDesk() {
  const [number, setNumber] = useState("");
  const [siteId, setSiteId] = useState<(typeof partnerSites)[number]["id"]>("seminar");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const site = partnerSites.find((item) => item.id === siteId) ?? partnerSites[0];

  const run = async () => {
    setBusy(true);
    try {
      const data = await verifyCertificate(number, site.apiKey);
      setNote(
        data.verified && data.certificate
          ? `Verified ${data.certificate.certificateNumber} · ${data.certificate.name} · ${data.certificate.event}.`
          : `No issued certificate matches that number.`
      );
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Verification did not complete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Certificate verification</h1>
        <p className="mt-1 text-sm text-slate-500">Check a certificate number against this site, the seminar site, or the autism site.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
          <input className={field} value={number} onChange={(event) => setNumber(event.target.value)} placeholder="Certificate number" />
          <select className={field} value={siteId} onChange={(event) => setSiteId(event.target.value as typeof siteId)}>
            {partnerSites.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button type="button" disabled={busy} className={button} onClick={() => void run()}>
            {busy ? "Checking…" : "Check"}
          </button>
        </div>
        {note && <p className="mt-3 text-sm text-slate-700">{note}</p>}
      </div>
    </div>
  );
}

export function ZeptoDesk() {
  const [token, setToken] = useState(() => getSettings().apiKeys.zeptomail);
  const [to, setTo] = useState(() => getSettings().supportEmail);
  const [note, setNote] = useState("");
  const [outbox, setOutbox] = useState(() => getOutbox().slice(0, 5));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ZeptoMail</h1>
        <p className="mt-1 text-sm text-slate-500">Foundation mail goes through ZeptoMail. WhatsApp messaging is not connected.</p>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <input className={field} type="password" placeholder="ZeptoMail token" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="new-password" />
        <input className={field} placeholder="Send a test to" value={to} onChange={(event) => setTo(event.target.value)} />
        <div className="flex gap-2">
          <button
            type="button"
            className={ghost}
            onClick={() => {
              const settings = getSettings();
              settings.apiKeys.zeptomail = token.trim();
              saveSettings(settings);
              setNote("Token saved.");
            }}
          >
            Save token
          </button>
          <button
            type="button"
            className={button}
            onClick={() => {
              if (token.trim().length < 8) {
                setNote("Enter a ZeptoMail token of at least 8 characters before sending.");
                return;
              }
              const settings = getSettings();
              settings.apiKeys.zeptomail = token.trim();
              saveSettings(settings);
              sendEmail({
                to,
                subject: "VGMF ZeptoMail test",
                template: "zeptomail-test",
                body: "This message was queued on the ZeptoMail channel.",
              });
              setOutbox(getOutbox().slice(0, 5));
              setNote("Test message queued.");
            }}
          >
            Send test
          </button>
        </div>
        {note && <p className="text-sm text-emerald-700">{note}</p>}
      </div>
      <ul className="rounded-xl border border-slate-200 bg-white">
        {outbox.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Outbox is empty.</li>}
        {outbox.map((mail) => (
          <li key={mail.id} className="border-b border-slate-100 px-5 py-3 text-sm last:border-b-0">
            <span className="font-semibold text-slate-900">{mail.subject}</span>
            <span className="text-slate-500"> · {mail.to}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

