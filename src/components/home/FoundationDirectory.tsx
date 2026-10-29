import Link from "next/link";

const items = [
  {
    href: "/notices",
    eyebrow: "Gazette",
    title: "Official notices",
    text: "Deadlines, lists and circulars published from the admin desk.",
  },
  {
    href: "/events",
    eyebrow: "Programmes",
    title: "Events calendar",
    text: "Seminars, fellowships and workshops with current dates.",
  },
  {
    href: "/certificate-verification",
    eyebrow: "Records",
    title: "Verify a certificate",
    text: "Look up a Foundation certificate by its printed number.",
  },
  {
    href: "/clinics",
    eyebrow: "Care",
    title: "Clinics",
    text: "Consultation hours and directions for Foundation clinics.",
  },
];

export default function FoundationDirectory() {
  return (
    <section className="border-t border-border bg-white py-8" aria-label="Foundation services">
      <div className="container grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-border bg-paper px-4 py-4 transition hover:border-burgundy"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-burgundy">{item.eyebrow}</p>
            <p className="mt-1 font-serif text-base font-semibold text-ink">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-text-muted">{item.text}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
