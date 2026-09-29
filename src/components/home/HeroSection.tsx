import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  GraduationCap,
  MapPin,
  PlayCircle,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import Mandala from "@/components/graphics/Mandala";
import Wave from "@/components/graphics/Wave";
import { events } from "@/data/events";
import { formatDate } from "@/lib/utils";

export default function HeroSection() {
  const nextEvent = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  return (
    <section className="relative isolate overflow-hidden bg-hero text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-60" />
      <div className="pointer-events-none absolute -left-32 top-10 -z-10 h-96 w-96 rounded-full bg-burgundy/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 -z-10 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
      <Mandala className="pointer-events-none absolute -right-48 top-1/2 -z-10 h-[760px] w-[760px] -translate-y-1/2 text-gold/15 animate-spin-slow" />

      <div className="container grid items-center gap-14 pb-32 pt-16 lg:grid-cols-[1.15fr_1fr] lg:pb-40 lg:pt-24">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold backdrop-blur">
            <Sparkles size={14} />
            Est. in memory of Vaidya R. B. Gogate
          </span>

          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[4.25rem]">
            Preserving <span className="text-gradient-gold italic">Ayurveda</span>.
            <br />
            Advancing knowledge.
            <br />
            Serving society.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-white/75">
            A foundation dedicated to classical Ayurveda — through education, research,
            compassionate clinical care, publications and the living legacy of Vaidya R. B. Gogate.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link href="/programmes" className="btn-gold">
              Explore Programmes
              <ArrowRight size={18} />
            </Link>
            <Link href="/about/legacy-of-vaidya-rb-gogate" className="btn-ghost-light">
              <PlayCircle size={18} />
              Discover Our Legacy
            </Link>
          </div>

          <ul className="mt-12 grid max-w-xl grid-cols-3 gap-4 border-t border-white/10 pt-8">
            {[
              { icon: GraduationCap, label: "Education" },
              { icon: Stethoscope, label: "Clinical care" },
              { icon: BadgeCheck, label: "Certified courses" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-sm text-white/80">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-gold">
                  <Icon size={17} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="relative aspect-square">
            <div className="absolute inset-6 rounded-full border border-gold/25" />
            <div className="absolute inset-16 rounded-full border border-dashed border-white/15 animate-spin-slow" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative flex h-[62%] w-[62%] items-center justify-center rounded-full bg-gradient-to-br from-burgundy to-navy shadow-[0_40px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/10">
                <Mandala className="absolute inset-4 text-gold/40" strokeWidth={0.8} />
                <div className="relative text-center">
                  <p className="font-display text-5xl font-semibold text-gold sm:text-6xl">VGMF</p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">
                    Ayurveda · Education · Research
                  </p>
                </div>
              </div>
            </div>

            {nextEvent && (
              <Link
                href={`/events/${nextEvent.slug}`}
                className="glass absolute -left-4 top-6 w-64 rounded-2xl p-4 transition hover:-translate-y-1 animate-float sm:-left-10"
              >
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
                  Next event
                </p>
                <p className="mt-2 line-clamp-2 font-semibold leading-snug">{nextEvent.name}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-white/70">
                  <CalendarDays size={13} />
                  {formatDate(nextEvent.startDate)}
                </p>
                {nextEvent.city && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
                    <MapPin size={13} />
                    {nextEvent.city}
                  </p>
                )}
              </Link>
            )}

            <div
              className="glass absolute -right-2 bottom-10 flex items-center gap-3 rounded-2xl p-4 animate-float sm:-right-6"
              style={{ animationDelay: "-3.5s" }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold text-navy">
                <GraduationCap size={22} />
              </span>
              <span>
                <span className="block font-display text-2xl font-semibold">12,000+</span>
                <span className="block text-xs text-white/70">professionals trained</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <Wave className="absolute inset-x-0 bottom-0 text-white" />
    </section>
  );
}
