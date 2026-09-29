import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import ArticleCard from "@/components/articles/ArticleCard";
import { articles as defaultArticles } from "@/data/articles";

export default function FeaturedArticles({ articles = defaultArticles }: { articles?: typeof defaultArticles }) {
  const featured = articles.slice(0, 3);

  return (
    <section className="section bg-white" aria-labelledby="articles-heading">
      <div className="container">
        <SectionHeading
          eyebrow="Articles"
          title="From Our Journal"
          description="Perspectives on Ayurveda, research, education and the Foundation's work."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/articles" className="btn-outline">
            View All Articles
          </Link>
        </div>
      </div>
    </section>
  );
}