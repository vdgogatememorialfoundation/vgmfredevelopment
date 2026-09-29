import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";
import DynamicIcon from "@/components/common/DynamicIcon";
import Reveal from "@/components/common/Reveal";
import { programmes } from "@/data/site";

export default function ProgrammesSection() {
  return (
    <section className="section relative overflow-hidden bg-white" aria-labelledby="programmes-heading">
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="container relative">
        <SectionHeading
          id="programmes-heading"
          eyebrow="What we do"
          title="Six pillars of our work"
          description="From the classroom to the clinic, every programme carries forward the classical rigour and compassion that defined Vaidya Gogate's life."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programmes.map((programme, index) => (
            <Reveal key={programme.slug} delay={(index % 3) * 100}>
              <Link
                href={programme.href}
                className="card group relative flex h-full flex-col overflow-hidden p-7"
              >
                <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-burgundy/5 transition duration-500 group-hover:scale-[2.4] group-hover:bg-burgundy/[0.06]" />
                <div className="relative flex items-start justify-between">
                  <span className="icon-tile h-14 w-14 transition duration-300 group-hover:rotate-[-6deg] group-hover:bg-burgundy group-hover:text-white">
                    <DynamicIcon name={programme.icon} size={26} strokeWidth={1.7} />
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-muted transition group-hover:border-burgundy group-hover:bg-burgundy group-hover:text-white">
                    <ArrowUpRight size={16} />
                  </span>
                </div>
                <h3 className="relative mt-6 font-display text-xl font-semibold text-text-primary">
                  {programme.title}
                </h3>
                <p className="relative mt-2 text-sm leading-6 text-text-muted">{programme.description}</p>
                <ul className="relative mt-5 space-y-2 border-t border-border pt-5">
                  {programme.points.map((point) => (
                    <li key={point} className="flex items-center gap-2 text-sm text-text-primary">
                      <Check size={15} className="text-sage" />
                      {point}
                    </li>
                  ))}
                </ul>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
