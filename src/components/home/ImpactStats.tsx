import CountUp from "@/components/common/CountUp";
import Reveal from "@/components/common/Reveal";
import { impactStats } from "@/data/site";

export default function ImpactStats() {
  return (
    <section aria-label="Our impact" className="relative -mt-20 pb-6">
      <div className="container">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border shadow-[0_30px_60px_-30px_rgb(10_26_51/0.35)] sm:grid-cols-2 lg:grid-cols-4">
          {impactStats.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 90} className="group relative bg-white p-7 sm:p-8">
              <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-burgundy to-gold transition duration-500 group-hover:scale-x-100" />
              <p className="font-display text-4xl font-semibold text-burgundy sm:text-5xl">
                <CountUp end={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-2 font-semibold text-text-primary">{stat.label}</p>
              <p className="mt-1 text-sm leading-6 text-text-muted">{stat.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
