"use client";

import Link from "next/link";
import { articles } from "@/data/articles";
import { books } from "@/data/books";
import { clinics } from "@/data/clinics";
import { announcements, flyers, notices } from "@/data/content";
import { events } from "@/data/events";
import { videos } from "@/data/videos";

export type CatalogRecord = {
  id: string;
  title: string;
  meta: string;
  href: string;
};

const modules: {
  id: string;
  label: string;
  publicHref: string;
  adminHref: string;
  count: number;
  records: CatalogRecord[];
}[] = [
  {
    id: "shop",
    label: "Shop",
    publicHref: "/shop",
    adminHref: "/admin/commerce/products",
    count: books.length,
    records: books.map((book) => ({
      id: book.id,
      title: book.title,
      meta: `${book.category} · ₹${book.price.toLocaleString("en-IN")} · ${book.stock} in stock`,
      href: `/shop/${book.slug}`,
    })),
  },
  {
    id: "events",
    label: "Events",
    publicHref: "/events",
    adminHref: "/admin/events",
    count: events.length,
    records: events.map((event) => ({
      id: event.id,
      title: event.name,
      meta: `${event.eventType} · ${event.city ?? event.mode} · ${event.startDate}`,
      href: `/events/${event.slug}`,
    })),
  },
  {
    id: "articles",
    label: "Articles",
    publicHref: "/articles",
    adminHref: "/admin/articles",
    count: articles.length,
    records: articles.map((article) => ({
      id: article.id,
      title: article.title,
      meta: `${article.category} · ${article.date}`,
      href: `/articles/${article.slug}`,
    })),
  },
  {
    id: "videos",
    label: "Videos",
    publicHref: "/videos",
    adminHref: "/admin/website/videos",
    count: videos.length,
    records: videos.map((video) => ({
      id: video.id,
      title: video.title,
      meta: `${video.category} · ${video.date}`,
      href: "/videos",
    })),
  },
  {
    id: "clinics",
    label: "Clinics",
    publicHref: "/clinics",
    adminHref: "/admin/website/clinics",
    count: clinics.length,
    records: clinics.map((clinic) => ({
      id: clinic.id,
      title: clinic.name,
      meta: `${clinic.city} · ${clinic.doctor}`,
      href: `/clinics/${clinic.slug}`,
    })),
  },
  {
    id: "announcements",
    label: "Announcements",
    publicHref: "/announcements",
    adminHref: "/admin/website/announcements",
    count: announcements.length,
    records: announcements.map((item) => ({
      id: item.id,
      title: item.title,
      meta: `${item.category} · ${item.date}`,
      href: item.href,
    })),
  },
  {
    id: "notices",
    label: "Notice board",
    publicHref: "/notices",
    adminHref: "/admin/website/notices",
    count: notices.length,
    records: notices.map((item) => ({
      id: item.id,
      title: item.title,
      meta: `${item.category} · ${item.date}`,
      href: item.href,
    })),
  },
  {
    id: "flyers",
    label: "Slideshow images",
    publicHref: "/",
    adminHref: "/admin/website/flyers",
    count: flyers.length,
    records: flyers.map((item) => ({
      id: item.id,
      title: item.title,
      meta: `${item.event} · ${item.date}`,
      href: item.href,
    })),
  },
];

export function siteModule(id: string) {
  return modules.find((item) => item.id === id);
}

export function SiteModuleHub() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">Storefront</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Website modules</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Every public section of the Foundation site, with the admin screen that manages it
          and a direct link to the page customers see.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{item.count} live</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{item.label}</h2>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
              <Link href={item.adminHref} className="text-burgundy">
                Manage
              </Link>
              <Link href={item.publicHref} className="text-slate-500">
                View site
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SiteCatalog({ moduleId }: { moduleId: string }) {
  const entry = siteModule(moduleId);
  if (!entry) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-burgundy">Linked to the website</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{entry.label}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {entry.count} records currently published on the public site.
          </p>
        </div>
        <Link
          href={entry.publicHref}
          className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Open {entry.label} on the site
        </Link>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <ul>
          {entry.records.map((record) => (
            <li key={record.id} className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{record.title}</p>
                <p className="text-xs text-slate-500">{record.meta}</p>
              </div>
              <Link href={record.href} className="text-sm font-semibold text-burgundy">
                View
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
