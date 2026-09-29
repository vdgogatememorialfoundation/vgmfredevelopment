import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";
import Reveal from "@/components/common/Reveal";
import Mandala from "@/components/graphics/Mandala";
import { legacyTimeline } from "@/data/site";

export default function LegacySection() {
  return (
    <section className="section relative overflow-hidden bg-navy text-white" aria-labelledby="legacy-heading">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <Mandala className="pointer-events-none absolute -left-40 top-1/2 h-[640px] w-[640px] -translate-y-1/2 text-gold/10 animate-spin-slow" />

      <div className="container relative grid items-start gap-14 lg:grid-cols-[1fr_1.1fr]">
        <div className="lg:sticky lg:top-32">
          <SectionHeading
            id="legacy-heading"
            tone="dark"
            align="left"
            eyebrow="Our legacy"
            title="The life and work of Vaidya R. B. Gogate"
            description="Physician, teacher and scholar — Vaidya Gogate devoted his life to the study, practice and teaching of Ayurveda. The Foundation built in his memory carries this work forward."
          />

          <Reveal>
            <figure className="glass relative rounded-3xl p-7">
              <Quote className="absolute -top-4 left-6 h-9 w-9 rounded-full bg-gold p-2 text-navy" />
              <blockquote className="font-display text-xl italic leading-relaxed text-white/90">
                “Knowledge that is not shared is knowledge half-lived. Teach, heal, and write — so that
                Ayurveda remains a living science.”
              </blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-gold">— Vaidya R. B. Gogate</figcaption>
            </figure>
          </Reveal>

          <Link href="/about/legacy-of-vaidya-rb-gogate" className="btn-gold mt-8">
            Read the full story
            <ArrowRight size={18} />
          </Link>
        </div>

        <ol className="relative space-y-6 before:absolute before:bottom-0 before:left-[27px] before:top-0 before:w-px before:bg-gradient-to-b before:from-gold/0 before:via-gold/60 before:to-gold/0">
          {legacyTimeline.map((item, index) => (
            <Reveal as="li" key={item.year} delay={index * 90} variant="right" className="relative flex gap-6">
              <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-navy-light text-xs font-bold text-gold shadow-[0_0_0_6px_rgb(10_26_51)]">
                {item.year}
              </span>
              <div className="glass flex-1 rounded-2xl p-6 transition duration-300 hover:border-gold/40 hover:bg-white/10">
                <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/70">{item.description}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
