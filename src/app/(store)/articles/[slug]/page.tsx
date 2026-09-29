import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Badge from "@/components/common/Badge";
import ArticleCard from "@/components/articles/ArticleCard";
import RequireAuth from "@/components/auth/RequireAuth";
import { getArticles } from "@/lib/server/content";
import { formatDate } from "@/lib/utils";

interface ArticleDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const articles = await getArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: ArticleDetailPageProps): Promise<Metadata> {
  const articles = await getArticles();
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);

  if (!article) return {};

  return {
    title: article.title,
    description: article.excerpt,
  };
}

export default async function ArticleDetailPage({
  params,
}: ArticleDetailPageProps) {
  const articles = await getArticles();
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);

  if (!article) {
    notFound();
  }

  const related = articles
    .filter(
      (item) => item.slug !== article.slug && item.category === article.category
    )
    .slice(0, 3);

  const relatedFallback =
    related.length > 0
      ? related
      : articles.filter((item) => item.slug !== article.slug).slice(0, 3);

  return (
    <RequireAuth message="Sign in to read this article.">
      <main>
        <section className="border-b border-border bg-warm-cream">
        <div className="container py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <li>
                <Link href="/" className="transition hover:text-burgundy">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/articles" className="transition hover:text-burgundy">
                  Articles
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <span className="font-medium text-text-primary">
                  {article.title}
                </span>
              </li>
            </ol>
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="burgundy">{article.category}</Badge>
            <time className="text-sm text-text-muted" dateTime={article.date}>
              {formatDate(article.date)}
            </time>
            {article.readingTime && (
              <span className="text-sm text-text-muted">
                • {article.readingTime}
              </span>
            )}
          </div>

          <h1 className="heading-1 mt-4 max-w-4xl">{article.title}</h1>

          {article.author && (
            <p className="mt-5 text-sm font-medium text-text-muted">
              By {article.author}
            </p>
          )}
        </div>
      </section>

      <section className="section bg-background">
        <div className="container grid gap-12 lg:grid-cols-3">
          <article className="lg:col-span-2">
            <div className="prose prose-neutral max-w-none">
              {article.content.split("\n\n").map((paragraph, index) => (
                <p
                  key={index}
                  className="text-body mb-6"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            {article.tags && article.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-10 rounded-2xl border border-border bg-white p-6">
              <p className="text-sm font-semibold text-text-primary">Share this article</p>
              <div className="mt-3 flex gap-3">
                {["Facebook", "Twitter", "LinkedIn", "WhatsApp"].map((label) => (
                  <a
                    key={label}
                    href="#"
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-muted transition hover:border-burgundy hover:text-burgundy"
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </article>

          <aside className="space-y-8">
            <div>
              <h2 className="heading-3 mb-5">Related Articles</h2>
              <div className="space-y-6">
                {relatedFallback.map((item) => (
                  <ArticleCard key={item.id} article={item} />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
      </main>
    </RequireAuth>
  );
}