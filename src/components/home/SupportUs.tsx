"use client";

import Link from "next/link";
import { useSiteFlags } from "@/lib/use-cms";

export default function SupportUs() {
  const flags = useSiteFlags();
  if (!flags.supportUs) return null;

  return (
    <section className="section" aria-labelledby="support-us-heading">
      <div className="container flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-burgundy">Support Us</p>
          <h2 id="support-us-heading" className="heading-2 mt-2">
            {flags.supportUsTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-text-muted">{flags.supportUsText}</p>
        </div>
        <Link href={flags.supportUsHref || "/contact"} className="btn-primary">
          Support Us
        </Link>
      </div>
    </section>
  );
}
