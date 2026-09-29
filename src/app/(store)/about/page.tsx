import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import DynamicIcon from "@/components/common/DynamicIcon";
import Reveal from "@/components/common/Reveal";
import SectionHeading from "@/components/common/SectionHeading";
import { coreValues } from "@/data/site";

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
    icon: "Landmark",
  },
  {
    title: "Legacy of Vaidya R. B. Gogate",
    description:
      "The life, scholarship and enduring influence of the physician and teacher the Foundation honours.",
    href: "/about/legacy-of-vaidya-rb-gogate",
    icon: "Award",
  },
  {
    title: "Our History",
    description:
      "How the Foundation was established and the efforts that shaped its early years.",
    href: "/about/history",
    icon: "Milestone",
  },
  {
    title: "Trustees & Team",
    description:
      "The trustees, scholars and staff who guide and carry forward the Foundation's work.",
    href: "/about/trustees",
    icon: "Users",
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

      <section className="section bg-white">
        <div className="container grid gap-6 md:grid-cols-2">
          {cards.map((card, index) => (
            <Reveal key={card.href} delay={(index % 2) * 100}>
              <Link href={card.href} className="card group flex h-full items-start gap-6 p-8">
                <span className="icon-tile h-14 w-14 shrink-0 group-hover:bg-burgundy group-hover:text-white">
                  <DynamicIcon name={card.icon} size={24} />
                </span>
                <span>
                  <h2 className="heading-3">{card.title}</h2>
                  <p className="mt-3 text-text-muted">{card.description}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-burgundy">
                    Learn more
                    <ArrowRight size={16} className="transition group-hover:translate-x-1" />
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section bg-warm-cream">
        <div className="container">
          <SectionHeading eyebrow="Our values" title="The principles we stand by" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {coreValues.map((value, index) => (
              <Reveal key={value.title} delay={index * 90} className="card p-7 text-center">
                <span className="icon-tile mx-auto h-14 w-14">
                  <DynamicIcon name={value.icon} size={24} />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold">{value.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-muted">{value.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}