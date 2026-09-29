import { Leaf } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";
import Reveal from "@/components/common/Reveal";
import LeafSprig from "@/components/graphics/LeafSprig";
import { herbs } from "@/data/site";

export default function HerbsSection() {
  return (
    <section className="section relative overflow-hidden bg-sage-light/60" aria-labelledby="herbs-heading">
      <div className="pointer-events-none absolute inset-0 bg-rangoli opacity-50" />
      <LeafSprig className="pointer-events-none absolute left-6 top-10 hidden h-40 w-20 origin-bottom animate-sway lg:block" />
      <LeafSprig className="pointer-events-none absolute bottom-10 right-8 hidden h-40 w-20 origin-bottom -scale-x-100 animate-sway [animation-delay:-2s] lg:block" />
      <div className="container relative">
        <SectionHeading
          id="herbs-heading"
          eyebrow="Dravyaguna · द्रव्यगुण"
          title="Sacred herbs of the Ayurvedic pharmacopoeia"
          description="Time-tested medicinal plants studied, taught and documented through the Foundation's research and publications."
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {herbs.map((herb, index) => (
            <Reveal key={herb.name} delay={index * 80} className="h-full">
              <article className="group relative flex h-full items-start gap-5 overflow-hidden rounded-3xl border border-white bg-white/90 p-6 shadow-sm transition duration-500 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_-28px_rgb(47_138_62/0.55)]">
                <span
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full transition duration-500 group-hover:rotate-[-12deg] group-hover:scale-110"
                  style={{ backgroundColor: herb.bg, color: herb.color }}
                >
                  <Leaf size={28} />
                </span>
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-baseline gap-x-2 font-display text-xl font-semibold">
                    {herb.name}
                    <span className="font-sanskrit text-lg" style={{ color: herb.color }}>
                      {herb.sanskrit}
                    </span>
                  </h3>
                  <p className="text-xs italic text-text-muted">{herb.latin}</p>
                  <p className="mt-3 text-sm leading-6 text-text-muted">{herb.benefit}</p>
                </div>
                <span
                  className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 transition duration-500 group-hover:scale-x-100"
                  style={{ backgroundColor: herb.color }}
                />
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
