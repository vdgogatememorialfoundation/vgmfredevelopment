import type { Metadata } from "next";
import { readMobileFeed } from "@/lib/server/mobile-feed";
import { siteConfig } from "@/lib/constants";
import CmsPageView from "./CmsPageView";

export const dynamic = "force-dynamic";

function livePage(slug: string) {
  return (readMobileFeed().pages ?? []).find((page) => page.slug === slug && page.enabled) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = livePage((await params).slug);
  if (!page) return { title: `Page | ${siteConfig.name}` };
  return { title: `${page.title} | ${siteConfig.name}`, description: page.excerpt || undefined };
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = livePage((await params).slug);
  if (!page) return <CmsPageView />;
  return (
    <article className="container py-12 lg:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Foundation page</p>
      <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-ink sm:text-5xl">{page.title}</h1>
      {page.excerpt && <p className="mt-4 max-w-2xl text-lg leading-8 text-text-muted">{page.excerpt}</p>}
      <div className="prose mt-10 max-w-3xl whitespace-pre-wrap text-base leading-8 text-text-primary">{page.body}</div>
    </article>
  );
}
