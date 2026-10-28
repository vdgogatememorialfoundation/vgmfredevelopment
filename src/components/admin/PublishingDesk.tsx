"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { certificates, getCertificate } from "@/data/content";
import { AccountsSection } from "@/components/admin/AdminAccounts";
import {
  blankEvent,
  canEdit,
  contentModules,
  editorsFor,
  getArticle,
  getLiveEvents,
  getModuleAccess,
  getSiteFlags,
  hideAnnouncement,
  hideArticle,
  saveAnnouncement,
  saveArticle,
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
import { useLiveAnnouncements, useLiveArticles, useLiveEvents } from "@/lib/use-cms";
import type { Announcement, Article, Event, Order } from "@/types";
import type { OrderStatus } from "@/lib/admin-store";

ensureBootstrapped();

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const button = "rounded-lg bg-[#651C1C] px-4 py-2 text-sm font-semibold text-white";
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
          : `Assign this address under Roles, or use ${editorsFor(moduleId)[0]}.`}
      </p>
    </div>
  );
}

export function ArticleEditor({ articleId }: { articleId?: string | null }) {
  const existing = articleId ? getArticle(articleId) : undefined;
  const [email, setEmail] = useState("admin@vaidyagogate.org");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [excerpt, setExcerpt] = useState(existing?.excerpt ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [author, setAuthor] = useState(existing?.author ?? "");
  const [category, setCategory] = useState(existing?.category ?? "Ayurveda");
  const [featured, setFeatured] = useState(Boolean(existing?.featured));
  const [saved, setSaved] = useState("");

  const publish = () => {
    if (!canEdit("articles", email) || !title.trim() || !content.trim()) return;
    const article: Article = {
      id: existing?.id ?? `art-${Date.now()}`,
      title: title.trim(),
      slug: existing?.slug ?? slugify(title),
      excerpt: excerpt.trim() || content.trim().slice(0, 160),
      content: content.trim(),
      author: author.trim() || "VGMF",
      category: category.trim() || "Ayurveda",
      date: existing?.date ?? new Date().toISOString().slice(0, 10),
      featured,
      readingTime: existing?.readingTime ?? "4 min",
      tags: existing?.tags ?? [category.trim() || "Ayurveda"],
    };
    saveArticle(article);
    setSaved(article.slug);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{existing ? "Edit article" : "Create article"}</h1>
        <Link href="/admin/articles" className={ghost}>Back to articles</Link>
      </div>
      <EditorGate moduleId="articles" email={email} onEmail={setEmail} />
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <input className={field} placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <input className={field} placeholder="Author" value={author} onChange={(event) => setAuthor(event.target.value)} />
        <input className={field} placeholder="Category" value={category} onChange={(event) => setCategory(event.target.value)} />
        <textarea className={field} rows={3} placeholder="Excerpt" value={excerpt} onChange={(event) => setExcerpt(event.target.value)} />
        <textarea className={field} rows={10} placeholder="Article body" value={content} onChange={(event) => setContent(event.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />
          Feature on the homepage
        </label>
        <button type="button" className={button} onClick={publish}>Save article</button>
        {saved && (
          <p className="text-sm text-emerald-700">
            Published. <Link className="underline" href={`/articles/${saved}`}>View on the site</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function ArticleAdmin() {
  const articles = useLiveArticles();
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link href="/admin/articles/new" className={button}>+ Create article</Link>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <ul>
          {articles.map((article) => (
            <li key={article.id} className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{article.title}</p>
                <p className="text-xs text-slate-500">{article.category} · {article.author}</p>
              </div>
              <div className="flex gap-3 text-sm font-semibold">
                <Link className="text-[#651C1C]" href={`/admin/articles/new?id=${article.id}`}>Edit</Link>
                <Link className="text-slate-500" href={`/articles/${article.slug}`}>View</Link>
                <button type="button" className="text-slate-400" onClick={() => hideArticle(article.id)}>Hide</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
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
  const [email, setEmail] = useState("admin@vaidyagogate.org");
  const [title, setTitle] = useState(current?.title ?? "");
  const [description, setDescription] = useState(current?.description ?? "");
  const [href, setHref] = useState(current?.href ?? "/announcements");
  const [category, setCategory] = useState(current?.category ?? "News");
  const [priority, setPriority] = useState<"high" | "normal">(current?.priority ?? "high");
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
            <option value="high">Homepage</option>
            <option value="normal">Ticker only</option>
          </select>
        </div>
        <button type="button" className={button} onClick={publish}>{current ? "Update announcement" : "Publish announcement"}</button>
        {saved && <p className="text-sm text-emerald-700">Saved. The homepage ticker uses this list.</p>}
      </div>
      <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0">
            <div>
              <p className="font-semibold text-slate-900">{item.title}</p>
              <p className="text-xs text-slate-500">{item.priority} · {item.category}</p>
            </div>
            <div className="flex gap-3 text-sm font-semibold">
              <Link className="text-[#651C1C]" href={`/admin/website/announcements?id=${item.id}`}>Edit</Link>
              <button type="button" className="text-slate-400" onClick={() => hideAnnouncement(item.id)}>Hide</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EventEditor({ eventId }: { eventId?: string | null }) {
  const existing = eventId ? getLiveEvents().find((event) => event.id === eventId) : undefined;
  const [email, setEmail] = useState("admin@vaidyagogate.org");
  const [draft, setDraft] = useState<Event>(existing ?? blankEvent(""));
  const [saved, setSaved] = useState("");

  const set = (patch: Partial<Event>) => setDraft((current) => ({ ...current, ...patch }));

  const publish = () => {
    if (!canEdit("events", email) || !draft.name.trim()) return;
    const event = { ...draft, slug: draft.slug || slugify(draft.name), name: draft.name.trim() };
    saveEvent(event);
    setSaved(event.slug);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{existing ? "Edit event" : "Create event"}</h1>
        <Link href="/admin/events" className={ghost}>All events</Link>
      </div>
      <EditorGate moduleId="events" email={email} onEmail={setEmail} />
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <input className={`${field} sm:col-span-2`} placeholder="Event name" value={draft.name} onChange={(event) => set({ name: event.target.value, slug: existing ? draft.slug : slugify(event.target.value) })} />
        <input className={field} type="date" value={draft.startDate} onChange={(event) => set({ startDate: event.target.value })} />
        <input className={field} type="date" value={draft.endDate} onChange={(event) => set({ endDate: event.target.value })} />
        <input className={field} placeholder="City" value={draft.city ?? ""} onChange={(event) => set({ city: event.target.value })} />
        <input className={field} placeholder="Venue" value={draft.venue ?? ""} onChange={(event) => set({ venue: event.target.value })} />
        <select className={field} value={draft.mode} onChange={(event) => set({ mode: event.target.value as Event["mode"] })}>
          <option>Offline</option>
          <option>Online</option>
          <option>Hybrid</option>
        </select>
        <select className={field} value={draft.eventType} onChange={(event) => set({ eventType: event.target.value as Event["eventType"] })}>
          <option>Seminar</option>
          <option>Conference</option>
          <option>Workshop</option>
          <option>Webinar</option>
          <option>Fellowship</option>
          <option>Training</option>
          <option>Other Foundation Events</option>
        </select>
        <input className={field} type="number" min={0} value={draft.fee} onChange={(event) => set({ fee: Number(event.target.value) })} />
        <select className={field} value={draft.registrationStatus} onChange={(event) => set({ registrationStatus: event.target.value as Event["registrationStatus"] })}>
          <option>Open</option>
          <option>Closing Soon</option>
          <option>Waitlist</option>
          <option>Closed</option>
        </select>
        <textarea className={`${field} sm:col-span-2`} rows={3} placeholder="Short description" value={draft.shortDescription} onChange={(event) => set({ shortDescription: event.target.value })} />
        <textarea className={`${field} sm:col-span-2`} rows={6} placeholder="Full description" value={draft.description} onChange={(event) => set({ description: event.target.value })} />
        <div className="sm:col-span-2">
          <button type="button" className={button} onClick={publish}>Save event</button>
          {saved && (
            <p className="mt-3 text-sm text-emerald-700">
              Published. <Link className="underline" href={`/events/${saved}`}>View on the site</Link>
            </p>
          )}
        </div>
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
      <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {events.map((event) => (
          <li key={event.id} className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900">{event.name}</p>
              <p className="text-xs text-slate-500">{event.startDate} · {event.registrationStatus}</p>
            </div>
            <div className="flex gap-3 text-sm font-semibold">
              <Link className="text-[#651C1C]" href={`/admin/events/create?id=${event.id}`}>Edit</Link>
              <Link className="text-slate-500" href={`/events/${event.slug}`}>View</Link>
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
                  {["Pending", "Ordered", "Processing", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled"].map((status) => (
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

export function CustomerDesk() {
  return <AccountsSection fixedRole="customer" />;
}

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
        <h1 className="text-2xl font-bold text-slate-900">Module access</h1>
        <p className="mt-1 text-sm text-slate-500">admin@vaidyagogate.org can publish every module. Tick the staff addresses allowed to create and edit each one.</p>
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
  const [number, setNumber] = useState("VGMF-CERT-2026-0001");
  const [found, setFound] = useState<ReturnType<typeof getCertificate>>();
  const [checked, setChecked] = useState(false);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Certificate verification API</h1>
        <p className="mt-1 text-sm text-slate-500">
          seminar.vaidyagogate.org and autism.vaidyagogate.org call <span className="font-mono">GET /api/certificates/verify?number=</span> with header <span className="font-mono">x-api-key</span>.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {partnerSites.map((site) => (
          <div key={site.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{site.name}</p>
            <p className="mt-1 text-sm text-slate-700">{site.origin}</p>
            <p className="mt-2 font-mono text-sm text-[#651C1C]">{site.apiKey}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-800">Issued certificates</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {certificates.map((certificate) => (
            <li key={certificate.certificateNumber}>
              {certificate.certificateNumber} · {certificate.name} · {certificate.event}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <input className={field} value={number} onChange={(event) => setNumber(event.target.value)} />
          <button
            type="button"
            className={button}
            onClick={() => {
              setFound(getCertificate(number));
              setChecked(true);
            }}
          >
            Look up
          </button>
        </div>
        {checked && (
          <p className="mt-3 text-sm text-slate-700">
            {found ? `${found.name} · ${found.certificateType} · ${found.event}` : "No certificate matches that number."}
          </p>
        )}
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
        <input className={field} placeholder="ZeptoMail token" value={token} onChange={(event) => setToken(event.target.value)} />
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

