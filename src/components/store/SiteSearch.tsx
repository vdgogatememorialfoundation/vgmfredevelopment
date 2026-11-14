"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLiveArticles, useLiveBooks, useLiveEvents } from "@/lib/use-cms";

type Hit = { href: string; title: string; kind: string; note?: string };

const matches = (q: string, ...values: unknown[]) => values.some((value) => String(value ?? "").toLowerCase().includes(q));

export default function SiteSearch() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [text, setText] = useState(initial);
  const books = useLiveBooks();
  const articles = useLiveArticles();
  const events = useLiveEvents();
  const q = initial.trim().toLowerCase();

  const hits: Hit[] = !q
    ? []
    : [
        ...books
          .filter((book) => book.active !== false && matches(q, book.title, book.author, book.category, book.language, book.isbn, book.description))
          .map((book) => ({ href: `/shop/${book.slug}`, title: book.title, kind: "Shop", note: [book.author, book.language].filter(Boolean).join(" · ") })),
        ...articles
          .filter((article) => matches(q, article.title, article.category, (article as { excerpt?: string }).excerpt, (article as { author?: string }).author))
          .map((article) => ({ href: `/articles/${article.slug}`, title: article.title, kind: "Article", note: article.category })),
        ...events
          .filter((event) => matches(q, event.name, event.shortDescription, event.venue, event.city))
          .map((event) => ({ href: `/events/${event.slug}`, title: event.name, kind: "Event", note: [event.city, event.startDate?.slice(0, 10)].filter(Boolean).join(" · ") })),
      ];

  return (
    <section className="section bg-background">
      <div className="container mx-auto max-w-3xl">
        <h1 className="heading-2 mb-4">Search</h1>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            router.replace(`/search?q=${encodeURIComponent(text.trim())}`);
          }}
          className="flex gap-2"
        >
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Search books, products, articles and events"
            aria-label="Search the site"
            className="min-w-0 flex-1 rounded-lg border border-border bg-white px-4 py-3 text-base"
            autoFocus
          />
          <button type="submit" className="rounded-lg bg-burgundy px-5 py-3 font-semibold text-white">Search</button>
        </form>
        {q ? (
          <p className="mt-4 text-sm text-text-muted">
            {hits.length} result{hits.length === 1 ? "" : "s"} for “{initial}”
          </p>
        ) : null}
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white">
          {hits.map((hit) => (
            <li key={`${hit.kind}-${hit.href}`}>
              <Link href={hit.href} className="flex items-start justify-between gap-3 p-4 hover:bg-warm-cream/50">
                <span>
                  <span className="block font-semibold text-text-primary">{hit.title}</span>
                  {hit.note ? <span className="text-sm text-text-muted">{hit.note}</span> : null}
                </span>
                <span className="shrink-0 rounded-full bg-burgundy/10 px-2 py-0.5 text-xs font-semibold text-burgundy">{hit.kind}</span>
              </Link>
            </li>
          ))}
        </ul>
        {q && hits.length === 0 ? <p className="mt-4 text-sm text-text-muted">Nothing found. Try a shorter word.</p> : null}
      </div>
    </section>
  );
}
