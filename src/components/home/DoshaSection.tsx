import { Flame, Mountain, Wind, type LucideIcon } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";
import Reveal from "@/components/common/Reveal";
import Mandala from "@/components/graphics/Mandala";
import { doshas } from "@/data/site";

const icons: Record<(typeof doshas)[number]["icon"], LucideIcon> = {
  wind: Wind,
  flame: Flame,
  mountain: Mountain,
};

const tones: Record<(typeof doshas)[number]["tone"], { card: string; tile: string; text: string; chip: string }> = {
  peacock: {
    card: "from-peacock-light to-white",
    tile: "bg-peacock text-white",
    text: "text-peacock",
    chip: "bg-peacock/10 text-peacock",
  },
  saffron: {
    card: "from-gold-light to-white",
    tile: "bg-saffron text-white",
    text: "text-burgundy",
    chip: "bg-burgundy/10 text-burgundy",
  },
  green: {
    card: "from-sage-light to-white",
    tile: "bg-sage text-white",
    text: "text-sage",
    chip: "bg-sage/10 text-sage",
  },
};

export default function DoshaSection() {
  return (
    <section className="section relative overflow-hidden bg-white" aria-labelledby="dosha-heading">
      <Mandala className="pointer-events-none absolute -left-40 top-10 h-[520px] w-[520px] text-gold/25 animate-spin-slow" />
      <div className="container relative">
        <SectionHeading
          id="dosha-heading"
          eyebrow="Tridosha · त्रिदोष"
          title="The three doshas of Ayurveda"
          description="Every individual is a unique balance of Vata, Pitta and Kapha. Understanding your prakriti is the first step to lasting health."
        />

        <div className="grid gap-6 md:grid-cols-3">
          {doshas.map((dosha, index) => {
            const Icon = icons[dosha.icon];
            const tone = tones[dosha.tone];
            return (
              <Reveal key={dosha.name} delay={index * 120} variant="zoom" className="h-full">
                <article
                  className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-gradient-to-b p-8 transition duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_-30px_rgb(194_65_12/0.4)] ${tone.card}`}
                >
                  <span className="pointer-events-none absolute -right-4 -top-6 font-sanskrit text-[7rem] leading-none opacity-10 transition duration-500 group-hover:scale-110 group-hover:opacity-20">
                    {dosha.sanskrit}
                  </span>
                  <span className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition duration-500 group-hover:rotate-12 ${tone.tile}`}>
                    <Icon size={26} />
                  </span>
                  <h3 className="mt-6 flex items-baseline gap-3 font-display text-2xl font-semibold">
                    {dosha.name}
                    <span className={`font-sanskrit text-xl ${tone.text}`}>{dosha.sanskrit}</span>
                  </h3>
                  <p className={`mt-1 text-xs font-semibold uppercase tracking-[0.16em] ${tone.text}`}>
                    {dosha.elements}
                  </p>
                  <p className="mt-4 flex-1 text-sm leading-6 text-text-muted">{dosha.description}</p>
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {dosha.qualities.map((quality) => (
                      <li key={quality} className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.chip}`}>
                        {quality}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
