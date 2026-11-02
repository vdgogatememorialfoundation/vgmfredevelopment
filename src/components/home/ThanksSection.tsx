"use client";

import { useLiveThanks } from "@/lib/use-cms";

export default function ThanksSection() {
  const credits = useLiveThanks().filter((item) => item.title.trim() || item.description.trim());

  if (!credits.length) {
    return (
      <section className="section bg-white">
        <div className="container">
          <p className="text-sm text-text-muted">Credits published from the admin desk appear here.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section bg-white" aria-labelledby="special-thanks-heading">
      <div className="container">
        <h2 id="special-thanks-heading" className="sr-only">Special thanks</h2>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {credits.map((credit) => (
            <li key={credit.id} className="overflow-hidden rounded-2xl border border-border bg-white">
              {credit.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={credit.image} alt="" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="aspect-[4/3] bg-paper" />
              )}
              <div className="p-4">
                <p className="font-semibold text-text-primary">{credit.title}</p>
                {credit.description ? <p className="mt-2 text-sm text-text-primary">{credit.description}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
