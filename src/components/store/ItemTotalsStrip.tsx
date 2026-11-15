import type { ItemTotals } from "@/lib/order-item-totals";

export default function ItemTotalsStrip({ totals, label = "Items" }: { totals: ItemTotals; label?: string }) {
  if (!totals.total) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</span>
      <span className="rounded-full bg-burgundy/10 px-3 py-1 font-bold text-burgundy">{totals.total} items</span>
      {totals.books > 0 && <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">{totals.books} books</span>}
      {totals.languages.map(([language, count]) => (
        <span key={language} className="rounded-full border border-border px-3 py-1 text-text-primary">
          {language} <b>{count}</b>
        </span>
      ))}
      {totals.others.length > 0 && <span className="ml-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Other products</span>}
      {totals.others.map(([title, count]) => (
        <span key={title} className="rounded-full border border-dashed border-border px-3 py-1 text-text-primary">
          {title} <b>{count}</b>
        </span>
      ))}
    </div>
  );
}
