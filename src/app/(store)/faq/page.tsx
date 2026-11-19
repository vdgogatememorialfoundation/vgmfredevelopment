import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import { readMobileFeed } from "@/lib/server/mobile-feed";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers about events, registrations, certificates, the shop, orders, delivery and refunds.",
};

export default function FaqPage() {
  const faqs = (readMobileFeed().faqs ?? []).filter((item) => item.active !== false && item.question?.trim());
  const groups = new Map<string, typeof faqs>();
  for (const item of faqs) {
    const name = item.category?.trim() || "General";
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }

  return (
    <main>
      <PageHeader eyebrow="Help" title="Frequently Asked Questions" showDescription={false} />
      <section className="container max-w-3xl py-10 lg:py-14">
        {groups.size ? (
          [...groups.entries()].map(([name, items]) => (
            <div key={name} className="mb-10">
              <h2 className="text-lg font-semibold text-burgundy">{name}</h2>
              <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-white">
                {items.map((item) => (
                  <details key={item.id} className="group px-5 py-4">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium text-text-primary">
                      <span>{item.question}</span>
                      <span aria-hidden className="mt-0.5 shrink-0 text-burgundy transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-text-muted">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-text-muted">Questions will appear here soon.</p>
        )}
        <p className="mt-6 text-center text-sm text-text-muted">
          Didn&apos;t find your answer?{" "}
          <Link href="/contact" className="font-semibold text-burgundy underline">
            Contact us
          </Link>
        </p>
      </section>
    </main>
  );
}
