"use client";

import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import ArticleCard from "@/components/articles/ArticleCard";
import Badge from "@/components/common/Badge";
import { useLiveArticles } from "@/lib/use-cms";
import { formatDate } from "@/lib/utils";

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
            {article.content.split("\n\n").map((paragraph, index) => (
              <p key={index} className="text-body mb-6">{paragraph}</p>
            ))}
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
