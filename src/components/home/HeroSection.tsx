import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Flower2,
  GraduationCap,
  Leaf,
  MapPin,
  PlayCircle,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import Diya from "@/components/graphics/Diya";
import FallingPetals from "@/components/graphics/FallingPetals";
import LeafSprig from "@/components/graphics/LeafSprig";
import Lotus from "@/components/graphics/Lotus";
import Mandala from "@/components/graphics/Mandala";
import Toran from "@/components/graphics/Toran";
import Wave from "@/components/graphics/Wave";
import { events } from "@/data/events";
import { formatDate } from "@/lib/utils";

export default function HeroSection() {
  const nextEvent = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  return (
    <section className="relative isolate overflow-hidden bg-hero text-text-primary">
      <Toran className="absolute inset-x-0 top-0 z-10" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-rangoli opacity-70" />
      <div className="pointer-events-none absolute -left-32 top-24 -z-10 h-96 w-96 rounded-full bg-gold/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 -z-10 h-96 w-96 rounded-full bg-lotus/15 blur-3xl" />
      <Mandala className="pointer-events-none absolute -right-48 top-1/2 -z-10 h-[760px] w-[760px] -translate-y-1/2 text-burgundy/15 animate-spin-slow" />
      <FallingPetals />

      <div className="container grid items-center gap-14 pb-32 pt-24 lg:grid-cols-[1.15fr_1fr] lg:pb-40 lg:pt-32">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-burgundy/20 bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-burgundy shadow-sm backdrop-blur">
            <Sparkles size={14} />
            Est. in memory of Vaidya R. B. Gogate
          </span>

          <p className="mt-6 font-sanskrit text-xl text-sage sm:text-2xl">
            स्वस्थस्य स्वास्थ्य रक्षणम् · आतुरस्य विकार प्रशमनम्
          </p>

          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[4.25rem]">
            Preserving <span className="text-gradient-gold italic">Ayurveda</span>.
            <br />
            Advancing knowledge.
            <br />
            Serving society.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-text-muted">
            A foundation dedicated to classical Ayurveda — through education, research,
            compassionate clinical care, publications and the living legacy of Vaidya R. B. Gogate.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link href="/programmes" className="btn-primary">
              Explore Programmes
              <ArrowRight size={18} />
            </Link>
            <Link href="/about/legacy-of-vaidya-rb-gogate" className="btn-ghost-light">
              <PlayCircle size={18} />
              Discover Our Legacy
            </Link>
          </div>

          <ul className="mt-12 grid max-w-xl grid-cols-3 gap-4 border-t border-burgundy/15 pt-8">
            {[
              { icon: GraduationCap, label: "Education", tone: "bg-gold-light text-burgundy" },
              { icon: Stethoscope, label: "Clinical care", tone: "bg-sage-light text-sage" },
              { icon: Leaf, label: "Herbal wisdom", tone: "bg-lotus-light text-lotus" },
            ].map(({ icon: Icon, label, tone }) => (
              <li key={label} className="flex items-center gap-2.5 text-sm font-medium text-text-primary">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                  <Icon size={17} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="relative aspect-square">
            <div className="absolute inset-4 rounded-full border-2 border-dashed border-gold/50 animate-spin-slow" />
            <div className="absolute inset-12 rounded-full bg-gradient-to-br from-gold-light via-white to-lotus-light shadow-[0_40px_80px_-30px_rgb(194_65_12/0.45)]" />
            <Mandala className="absolute inset-12 text-burgundy/25 animate-spin-slow [animation-direction:reverse]" strokeWidth={1.2} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="animate-float">
                <Lotus className="h-40 w-56 drop-shadow-[0_12px_20px_rgb(224_69_123/0.3)] sm:h-48 sm:w-64" />
              </div>
              <p className="mt-1 font-display text-4xl font-semibold text-burgundy sm:text-5xl">VGMF</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-sage">
                Ayurveda · Education · Research
              </p>
            </div>

            <LeafSprig className="absolute -left-2 bottom-4 h-32 w-16 origin-bottom animate-sway sm:left-4" />
            <LeafSprig className="absolute -right-2 top-8 h-24 w-12 origin-bottom -scale-x-100 animate-sway [animation-delay:-3s]" />

            {nextEvent && (
              <Link
                href={`/events/${nextEvent.slug}`}
                className="glass absolute -left-4 top-4 hidden w-64 sm:block rounded-2xl p-4 transition hover:-translate-y-1 animate-float sm:-left-10"
              >
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sage">
                  <span className="h-1.5 w-1.5 rounded-full bg-sage animate-pulse-soft" />
                  Next event
                </p>
                <p className="mt-2 line-clamp-2 font-semibold leading-snug">{nextEvent.name}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                  <CalendarDays size={13} className="text-burgundy" />
                  {formatDate(nextEvent.startDate)}
                </p>
                {nextEvent.city && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
                    <MapPin size={13} className="text-burgundy" />
                    {nextEvent.city}
                  </p>
                )}
              </Link>
            )}

            <div
              className="glass absolute -right-2 bottom-10 hidden sm:flex items-center gap-3 rounded-2xl p-4 animate-float sm:-right-6"
              style={{ animationDelay: "-3.5s" }}
            >
              <Diya className="h-11 w-11" />
              <span>
                <span className="block font-display text-2xl font-semibold text-burgundy">12,000+</span>
                <span className="block text-xs text-text-muted">professionals trained</span>
              </span>
            </div>

            <span className="absolute bottom-0 left-1/2 hidden -translate-x-1/2 whitespace-nowrap sm:flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-sage shadow-md">
              <Flower2 size={14} className="text-lotus" />
              Rooted in the Charaka &amp; Sushruta traditions
            </span>
          </div>
        </div>
      </div>

      <Wave className="absolute inset-x-0 bottom-0 text-white" />
    </section>
  );
}
