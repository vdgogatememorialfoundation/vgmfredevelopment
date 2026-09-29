import Reveal from "@/components/common/Reveal";
import Diya from "@/components/graphics/Diya";
import Mandala from "@/components/graphics/Mandala";
import Ornament from "@/components/graphics/Ornament";
import { shloka } from "@/data/site";

export default function ShlokaBand() {
  return (
    <section className="relative overflow-hidden bg-saffron py-16 text-white sm:py-20" aria-label="Ayurvedic verse">
      <div className="pointer-events-none absolute inset-0 bg-rangoli opacity-40" />
      <Mandala className="pointer-events-none absolute -left-24 top-1/2 h-[420px] w-[420px] -translate-y-1/2 text-white/20 animate-spin-slow" />
      <Mandala className="pointer-events-none absolute -right-24 top-1/2 h-[420px] w-[420px] -translate-y-1/2 text-white/20 animate-spin-slow [animation-direction:reverse]" />
      <Reveal className="container relative text-center">
        <div className="flex items-center justify-center gap-6">
          <Diya className="h-12 w-12" />
          <Ornament className="text-white" />
          <Diya className="h-12 w-12" />
        </div>
        <p className="mx-auto mt-6 max-w-4xl font-sanskrit text-2xl leading-relaxed sm:text-4xl">{shloka.sanskrit}</p>
        <p className="mx-auto mt-4 max-w-3xl text-sm italic text-white/85 sm:text-base">{shloka.transliteration}</p>
        <p className="mx-auto mt-4 max-w-2xl font-display text-lg sm:text-xl">“{shloka.meaning}”</p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-gold-light">— {shloka.source}</p>
      </Reveal>
    </section>
  );
}
