"use client";

import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import ArticleCard from "@/components/articles/ArticleCard";
import Badge from "@/components/common/Badge";
import { useLiveArticles } from "@/lib/use-cms";
import { formatDate } from "@/lib/utils";
import type { Article, CaptionedImage } from "@/types";

function Figure({ image, alt }: { image: CaptionedImage; alt: string }) {
  return (
    <figure className="mb-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt={image.caption || alt} className="w-full rounded-xl border border-border object-cover" />
      {image.caption && <figcaption className="mt-2 text-center text-sm text-text-muted">{image.caption}</figcaption>}
    </figure>
  );
}

function ArticleBody({ article }: { article: Article }) {
  const images = article.images ?? [];
  const placed = new Set<number>();
  const blocks = article.content.split(/\n\s*\n/).map((block, index) => {
    const text = block.trim();
    const token = text.match(/^\[\[image:(\d+)\]\]$/);
    if (token) {
      const position = Number(token[1]) - 1;
      const image = images[position];
      if (!image) return null;
      placed.add(position);
      return <Figure key={index} image={image} alt={article.title} />;
    }
    if (text.startsWith("## ")) {
      return <h2 key={index} className="heading-3 mb-4 mt-8">{text.slice(3)}</h2>;
    }
    return <p key={index} className="text-body mb-6 whitespace-pre-line">{text}</p>;
  });
  const remaining = images.filter((_, index) => !placed.has(index));
  return (
    <>
      {blocks}
      {remaining.length > 0 && (
        <div className="mt-10 border-t border-border pt-8">
          <h2 className="heading-3 mb-5">Gallery</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {remaining.map((image, index) => (
              <Figure key={index} image={image} alt={article.title} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function ArticlesIndex() {
  const articles = useLiveArticles();
  const featured = articles.filter((article) => article.featured);
  const rest = articles.filter((article) => !article.featured);

  return (
    <main>
      <PageHeader
        eyebrow="Articles"
        title="Articles & Perspectives"
        description="Thoughts on Ayurveda, research, education and the Foundation's continuing work."
      />
      {featured.length > 0 && (
        <section className="section bg-background">
          <div className="container">
            <h2 className="heading-3 mb-8">Featured</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featured.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        </section>
      )}
      {rest.length > 0 && (
        <section className="section bg-warm-cream">
          <div className="container">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        </section>
      )}
      {articles.length === 0 && (
        <section className="section bg-background">
          <div className="container">
            <p className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-text-muted">
              No articles are published yet.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}

export function ArticleView({ slug }: { slug: string }) {
  const articles = useLiveArticles();
  const article = articles.find((item) => item.slug === slug);
  if (!article) {
    return (
      <main className="container py-20">
        <h1 className="heading-2">Article not published</h1>
        <p className="mt-3 text-text-muted">This article is not on the public site.</p>
        <Link href="/articles" className="btn-outline mt-6">All articles</Link>
      </main>
    );
  }
  const related = articles.filter((item) => item.slug !== article.slug).slice(0, 3);

  return (
    <main>
      <section className="border-b border-border bg-warm-cream">
        <div className="container py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="mb-5 text-sm text-text-muted">
            <Link href="/" className="hover:text-burgundy">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/articles" className="hover:text-burgundy">Articles</Link>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="burgundy">{article.category}</Badge>
            <time className="text-sm text-text-muted" dateTime={article.date}>{formatDate(article.date)}</time>
          </div>
          <h1 className="heading-1 mt-4 max-w-4xl">{article.title}</h1>
          {article.author && <p className="mt-5 text-sm font-medium text-text-muted">By {article.author}</p>}
        </div>
      </section>
      <section className="section bg-background">
        <div className="container grid gap-12 lg:grid-cols-3">
          <article className="lg:col-span-2">
            {article.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={article.coverImage} alt={article.title} className="mb-8 aspect-[16/9] w-full rounded-2xl border border-border object-cover" />
            )}
            <ArticleBody article={article} />
          </article>
          <aside className="space-y-6">
            <h2 className="heading-3">Related Articles</h2>
            {related.map((item) => (
              <ArticleCard key={item.id} article={item} />
            ))}
          </aside>
        </div>
      </section>
    </main>
  );
}
