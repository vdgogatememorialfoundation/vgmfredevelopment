import { DETAIL_SECTIONS, bookSpecRows } from "@/lib/book-details";
import type { Book } from "@/types";

function Body({ text }: { text: string }) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const bullets = lines.length > 1 && lines.every((line) => /^[-•*]/.test(line));
  if (bullets) {
    return (
      <ul className="list-disc space-y-1 pl-5 text-body">
        {lines.map((line, index) => <li key={index}>{line.replace(/^[-•*]\s*/, "")}</li>)}
      </ul>
    );
  }
  return <p className="whitespace-pre-line text-body">{text.trim()}</p>;
}

export default function BookDetails({ book }: { book: Book }) {
  const sections = DETAIL_SECTIONS.filter((section) => book.details?.[section.key]?.trim());
  const rows = bookSpecRows(book);
  const people = (book.contributors ?? []).filter((person) => person.name.trim());
  return (
    <>
      {(book.audience?.length ?? 0) > 0 && (
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Suitable for">
          {book.audience!.filter(Boolean).map((tag) => (
            <span key={tag} className="rounded-full border border-navy/20 bg-white px-3 py-1 text-xs font-semibold text-navy">{tag}</span>
          ))}
        </div>
      )}
      {sections.length ? (
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.key}>
              <h3 className="mb-2 font-serif text-lg text-ink">{section.label}</h3>
              <Body text={book.details![section.key]!} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-body">{book.description}</p>
      )}

      {people.length > 0 && (
        <div className="mt-10">
          <h2 className="heading-3 mb-5">Authors and contributors</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {people.map((person, index) => (
              <div key={`${person.name}-${index}`} className="flex gap-3 rounded-2xl border border-border bg-white p-4">
                {person.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={person.photo} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-paper font-serif text-xl text-navy">{person.name.trim()[0]}</span>
                )}
                <div>
                  <p className="font-semibold text-ink">{person.name}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-burgundy">{person.role}</p>
                  {person.bio ? <p className="mt-1 text-sm text-text-muted">{person.bio}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <h2 className="heading-3 mb-5">Specifications</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <dl>
            {rows.map(([label, value], index) => (
              <div key={label} className={`grid grid-cols-3 gap-4 px-5 py-3.5 text-sm ${index % 2 === 1 ? "bg-warm-cream/60" : ""}`}>
                <dt className="font-medium text-text-muted">{label}</dt>
                <dd className="col-span-2 text-text-primary">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </>
  );
}
