"use client";

import { useParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getCmsPageBySlug, subscribeCmsPages } from "@/lib/cms-pages";

function snapshot() {
  return window.localStorage.getItem("vgmf_cms_pages") ?? "";
}

export default function CmsPageView() {
  const params = useParams<{ slug: string }>();
  useSyncExternalStore(subscribeCmsPages, snapshot, () => "");
  const page = getCmsPageBySlug(String(params.slug ?? ""));

  if (!page || !page.enabled) {
    return (
      <div className="container py-16">
        <div className="mx-auto max-w-lg rounded-3xl border border-border bg-white p-8 text-center">
          <h1 className="font-serif text-3xl text-ink">Page not found</h1>
          <p className="mt-3 text-sm text-text-muted">This page is not published on the main site.</p>
        </div>
      </div>
    );
  }

  return (
    <article className="container py-12 lg:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Foundation page</p>
      <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-ink sm:text-5xl">{page.title}</h1>
      {page.excerpt && <p className="mt-4 max-w-2xl text-lg leading-8 text-text-muted">{page.excerpt}</p>}
      <div className="prose mt-10 max-w-3xl whitespace-pre-wrap text-base leading-8 text-text-primary">
        {page.body}
      </div>
    </article>
  );
}
