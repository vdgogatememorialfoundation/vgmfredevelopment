"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveAwards } from "@/lib/use-cms";

export default function AwardsSection({ variant = "home" }: { variant?: "home" | "page" }) {
  const awards = useLiveAwards().filter((item) => item.personName || item.awardName);
  const categories = useMemo(
    () => [...new Set(awards.map((item) => item.category.trim()).filter(Boolean))],
    [awards]
  );
  const [category, setCategory] = useState("all");
  const shown = awards.filter((item) => category === "all" || item.category === category);
  const listed = variant === "home" ? shown.slice(0, 4) : shown;

  if (!awards.length) return null;

  return (
    <section className={variant === "page" ? "section bg-white" : "section-paper"} aria-labelledby="prize-awards-heading">
      <div className="container">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-burgundy">Recognition</p>
            <h2 id="prize-awards-heading" className="heading-3 mt-1">Awards</h2>
          </div>
          {variant === "home" && (
            <Link href="/awards" className="text-sm font-semibold text-burgundy">
              All awards
            </Link>
          )}
        </div>
        <label className="block max-w-md text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-burgundy">Category</span>
          <select className="input-field" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All seminars</option>
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {listed.map((award) => (
            <li key={award.id} className="overflow-hidden rounded-2xl border border-border bg-white">
              {award.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={award.image} alt="" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="aspect-[4/3] bg-paper" />
              )}
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-burgundy">{award.category || "Award"}</p>
                <p className="mt-1 font-semibold text-text-primary">{award.personName}</p>
                <p className="text-sm text-text-muted">{award.awardName}</p>
                {award.competitionType && <p className="mt-1 text-xs text-text-muted">{award.competitionType}{award.year ? ` · ${award.year}` : ""}</p>}
                {award.note && variant === "page" && <p className="mt-2 text-sm text-text-primary">{award.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
