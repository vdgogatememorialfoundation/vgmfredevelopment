import { Landmark } from "lucide-react";
import { partners as defaultPartners } from "@/data/site";

export default function Partners({ partners = defaultPartners }: { partners?: typeof defaultPartners }) {
  const row = [...partners, ...partners];

  return (
    <section aria-label="Partners and affiliations" className="border-y border-border bg-white py-12">
      <div className="container">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">
          In collaboration with institutions across India
        </p>
      </div>
      <div className="mask-fade-x mt-8 overflow-hidden">
        <ul className="flex w-max items-center gap-12 animate-marquee-slow">
          {row.map((partner, index) => (
            <li
              key={`${partner}-${index}`}
              className="flex shrink-0 items-center gap-3 text-text-muted grayscale transition hover:text-burgundy hover:grayscale-0"
            >
              <Landmark size={22} strokeWidth={1.5} className="text-gold" />
              <span className="font-display text-lg font-medium">{partner}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
