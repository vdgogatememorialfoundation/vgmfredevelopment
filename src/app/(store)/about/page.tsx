import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about the Vaidya Gogate Memorial Foundation — our mission, history, trustees and the enduring legacy of Vaidya R. B. Gogate.",
};

const cards = [
  {
    title: "About the Foundation",
    description:
      "Our mission, vision and programmes — from clinical care to research and publication.",
    href: "/about/foundation",
  },
  {
    title: "Legacy of Vaidya R. B. Gogate",
    description:
      "The life, scholarship and enduring influence of the physician and teacher the Foundation honours.",
    href: "/about/legacy-of-vaidya-rb-gogate",
  },
  {
    title: "Our History",
    description:
      "How the Foundation was established and the efforts that shaped its early years.",
    href: "/about/history",
  },
  {
    title: "Trustees & Team",
    description:
      "The trustees, scholars and staff who guide and carry forward the Foundation's work.",
    href: "/about/trustees",
  },
];

export default function AboutPage() {
  return (
    <main>
      <PageHeader
        eyebrow="About Us"
        title="About the Foundation"
        description="Vaidya Gogate Memorial Foundation preserves the classical traditions of Ayurveda, advances knowledge through education and research, and serves society through clinical and community programmes."
      />

      <section className="section bg-background">
        <div className="container grid gap-6 md:grid-cols-2">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="card p-8 transition hover:-translate-y-0.5"
            >
              <h2 className="heading-3">{card.title}</h2>
              <p className="mt-3 text-text-muted">{card.description}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-burgundy">
                Learn More
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}