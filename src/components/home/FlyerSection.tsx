"use client";

import Link from "next/link";
import SectionHeading from "@/components/common/SectionHeading";
import { useLiveFlyers } from "@/lib/use-cms";
import { formatDate } from "@/lib/utils";

export default function FlyerSection() {
  const flyers = useLiveFlyers();
  return (
    <section className="section" aria-labelledby="flyers-heading">
      <div className="container">
        <SectionHeading
          eyebrow="Promotional Banners"
          title="Featured Events"
          description="Explore our upcoming flagship events and programs."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {flyers.map((flyer) => (
            <article key={flyer.id} className="card overflow-hidden">
              <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-burgundy/10 to-warm-cream">
                {/^(https?:|data:image|\/)/i.test(flyer.image) || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(flyer.image) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={flyer.image} alt={flyer.title} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="px-6 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-burgundy/30 bg-white/90">
                      <span className="text-sm font-bold text-burgundy">VGMF</span>
                    </div>
                    <p className="text-lg font-semibold text-text-primary">
                      {flyer.title}
                    </p>
                    <p className="text-sm text-text-muted">{flyer.event}</p>
                  </div>
                </div>
                )}
              </div>

              <div className="p-6">
                <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
                  <time dateTime={flyer.date}>
                    {formatDate(flyer.date)}
                  </time>
                  <span aria-hidden="true">•</span>
                  <span>{flyer.event}</span>
                </div>

                <h3 className="mt-3 text-lg font-semibold leading-snug text-text-primary">
                  {flyer.title}
                </h3>

                <Link
                  href={flyer.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-burgundy transition hover:text-burgundy-dark"
                >
                  {flyer.cta}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}