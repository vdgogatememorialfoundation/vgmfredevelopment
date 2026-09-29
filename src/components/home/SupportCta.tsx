import Link from "next/link";
import { ArrowRight, HeartHandshake } from "lucide-react";
import DynamicIcon from "@/components/common/DynamicIcon";
import Reveal from "@/components/common/Reveal";
import Mandala from "@/components/graphics/Mandala";
import { donationCauses } from "@/data/site";

export default function SupportCta() {
  return (
    <section className="section bg-warm-cream" aria-labelledby="support-heading">
      <div className="container">
        <Reveal variant="zoom">
          <div className="relative overflow-hidden rounded-[2rem] border border-border bg-hero p-8 text-text-primary shadow-[0_40px_80px_-40px_rgb(194_65_12/0.45)] sm:p-12 lg:p-16">
            <div className="pointer-events-none absolute inset-0 bg-rangoli opacity-70" />
            <Mandala className="pointer-events-none absolute -right-32 -top-32 h-[520px] w-[520px] text-burgundy/15 animate-spin-slow" />
            <div className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-lotus-light px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-lotus">
                  <HeartHandshake size={14} /> Support our mission
                </span>
                <h2 id="support-heading" className="mt-5 font-display text-3xl font-semibold leading-tight sm:text-5xl">
                  Help keep classical Ayurveda <span className="text-gradient-gold italic">alive</span> for the next generation.
                </h2>
                <p className="mt-5 max-w-lg text-text-muted">
                  Your contribution funds scholarships, research, free community health camps and the
                  preservation of rare texts.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link href="/donate" className="btn-primary">
                    Donate now <ArrowRight size={18} />
                  </Link>
                  <Link href="/contact" className="btn-ghost-light">
                    Partner with us
                  </Link>
                </div>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {donationCauses.map((cause) => (
                  <li key={cause.title} className="glass rounded-2xl p-5 transition duration-300 hover:-translate-y-1 hover:border-burgundy/30">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-light text-burgundy">
                      <DynamicIcon name={cause.icon} size={20} />
                    </span>
                    <p className="mt-4 font-semibold">{cause.title}</p>
                    <p className="mt-1 text-sm leading-6 text-text-muted">{cause.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
