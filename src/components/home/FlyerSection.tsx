import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";
import Reveal from "@/components/common/Reveal";
import Mandala from "@/components/graphics/Mandala";
import { flyers } from "@/data/content";
import { formatDate } from "@/lib/utils";

const tones = [
  "from-navy via-burgundy-dark to-burgundy",
  "from-sage via-[#1f5a41] to-navy",
  "from-[#7a4f1f] via-gold to-burgundy-dark",
];

export default function FlyerSection() {
  return (
    <section className="section bg-warm-cream" aria-labelledby="flyers-heading">
      <div className="container">
        <SectionHeading
          id="flyers-heading"
          eyebrow="In the spotlight"
          title="Featured events"
          description="Flagship programmes open for registration now."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {flyers.map((flyer, index) => (
            <Reveal key={flyer.id} delay={index * 100} variant="zoom">
              <Link
                href={flyer.href}
                className={`group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br p-7 text-white shadow-[0_30px_60px_-30px_rgb(10_26_51/0.6)] ${tones[index % tones.length]}`}
              >
                <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
                <Mandala className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 text-white/15 transition duration-[1.5s] group-hover:rotate-90" />
                <span className="absolute left-7 top-7 rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] backdrop-blur">
                  Featured
                </span>
                <div className="relative">
                  <p className="flex items-center gap-2 text-xs font-medium text-gold-light">
                    <CalendarDays size={14} />
                    <time dateTime={flyer.date}>{formatDate(flyer.date)}</time>
                  </p>
                  <h3 className="mt-3 font-display text-2xl font-semibold leading-tight sm:text-3xl">
                    {flyer.title}
                  </h3>
                  <p className="mt-2 text-sm text-white/75">{flyer.event}</p>
                  <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-navy transition group-hover:gap-3 group-hover:bg-gold">
                    {flyer.cta}
                    <ArrowRight size={16} />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
