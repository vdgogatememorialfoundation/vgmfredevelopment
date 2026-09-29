import type { Metadata } from "next";
import PageHeader from "@/components/common/PageHeader";
import ArticleCard from "@/components/articles/ArticleCard";
import RequireAuth from "@/components/auth/RequireAuth";
import { getArticles } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "Articles",
  description:
    "Articles and perspectives on Ayurveda, research, education and the legacy of Vaidya R. B. Gogate.",
};

export default async function ArticlesPage() {
  const articles = await getArticles();
  const featured = articles.filter((article) => article.featured);
  const rest = articles.filter((article) => !article.featured);

  return (
    <RequireAuth message="Sign in to read articles from the Foundation's scholars and physicians.">
      <main>
        <PageHeader
          eyebrow="Articles"
          title="Articles & Perspectives"
          description="Thoughts on Ayurveda, research, education and the Foundation's continuing work, written by our scholars and physicians."
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
              <h2 className="heading-3 mb-8">All Articles</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </RequireAuth>
  );
}