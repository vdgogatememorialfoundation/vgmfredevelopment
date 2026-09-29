import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import SectionHeading from "@/components/common/SectionHeading";
import DynamicIcon from "@/components/common/DynamicIcon";
import Reveal from "@/components/common/Reveal";
import CountUp from "@/components/common/CountUp";
import SupportCta from "@/components/home/SupportCta";
import { coreValues, impactStats, programmes } from "@/data/site";

export const metadata: Metadata = {
  title: "Programmes",
  description:
    "Education, research, clinical care, publications, community health and seminars — the programmes of the Vaidya Gogate Memorial Foundation.",
};

const journey = [
  { step: "01", title: "Discover", description: "Browse events, courses and clinics that match your interest." },
  { step: "02", title: "Register", description: "Sign up on the seminar or fellowship website in a few minutes." },
  { step: "03", title: "Learn & practise", description: "Attend sessions guided by senior vaidyas and scholars." },
  { step: "04", title: "Get certified", description: "Receive a verifiable certificate linked to your account." },
];

export default function ProgrammesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Our work"
        title="Programmes of the Foundation"
        description="Six connected areas of work that preserve classical Ayurveda, advance knowledge and serve society."
        breadcrumb={[{ name: "Programmes", href: "/programmes" }]}
      />

      <section className="section bg-white">
        <div className="container space-y-8">
          {programmes.map((programme, index) => (
            <Reveal key={programme.slug} variant={index % 2 === 0 ? "left" : "right"}>
              <article
                id={programme.slug === "community" ? "community" : programme.slug}
                className="card-static grid scroll-mt-32 items-center gap-8 overflow-hidden p-6 sm:p-10 lg:grid-cols-[auto_1fr_auto]"
              >
                <span className="icon-tile h-20 w-20 rounded-3xl">
                  <DynamicIcon name={programme.icon} size={36} strokeWidth={1.5} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                    Programme {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-text-primary sm:text-3xl">
                    {programme.title}
                  </h2>
                  <p className="mt-3 max-w-2xl text-text-muted">{programme.description}</p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {programme.points.map((point) => (
                      <li
                        key={point}
                        className="inline-flex items-center gap-1.5 rounded-full bg-warm-cream px-3 py-1.5 text-sm text-text-primary"
                      >
                        <Check size={14} className="text-sage" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link href={programme.href} className="btn-outline shrink-0">
                  Explore <ArrowRight size={16} />
                </Link>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section relative overflow-hidden bg-navy text-white">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="container relative">
          <SectionHeading
            tone="dark"
            eyebrow="Your journey"
            title="From interest to certification"
            description="A simple, transparent path for every student and practitioner."
          />
          <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {journey.map((item, index) => (
              <Reveal as="li" key={item.step} delay={index * 100} className="glass relative rounded-3xl p-7">
                <span className="font-display text-5xl font-semibold text-gold/40">{item.step}</span>
                <h3 className="mt-4 font-display text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/70">{item.description}</p>
              </Reveal>
            ))}
          </ol>
          <div className="mt-14 grid gap-6 border-t border-white/10 pt-12 sm:grid-cols-2 lg:grid-cols-4">
            {impactStats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-4xl font-semibold text-gold">
                  <CountUp end={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-1 text-sm text-white/70">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container">
          <SectionHeading eyebrow="Our values" title="What guides every programme" />
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

      <SupportCta />
    </>
  );
}
