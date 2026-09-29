"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import Accordion from "@/components/common/Accordion";
import { faqCategories as defaultFaqCategories } from "@/data/site";
import { classNames } from "@/lib/utils";

export default function FaqBrowser({
  faqCategories = defaultFaqCategories,
}: {
  faqCategories?: { title: string; items: { question: string; answer: string }[] }[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqCategories
      .filter((group) => category === "All" || group.title === category)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !q || `${item.question} ${item.answer}`.toLowerCase().includes(q)),
      }))
      .filter((group) => group.items.length > 0);
  }, [query, category, faqCategories]);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_1fr]">
      <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
        <label className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 focus-within:border-burgundy">
          <Search size={18} className="text-text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search questions"
            aria-label="Search questions"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <nav className="mt-4 flex gap-2 overflow-x-auto lg:flex-col" aria-label="FAQ categories">
          {["All", ...faqCategories.map((group) => group.title)].map((title) => (
            <button
              key={title}
              type="button"
              onClick={() => setCategory(title)}
              className={classNames(
                "shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition",
                category === title ? "bg-burgundy text-white" : "text-text-primary hover:bg-white"
              )}
            >
              {title}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-10">
        {groups.length === 0 ? (
          <p className="rounded-2xl border border-border bg-white p-10 text-center text-text-muted">
            No questions match “{query}”.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.title}>
              <h2 className="mb-4 font-display text-2xl font-semibold text-text-primary">{group.title}</h2>
              <Accordion key={`${group.title}-${query}`} items={group.items} defaultOpen={null} />
            </section>
          ))
        )}
      </div>
    </div>
  );
}
