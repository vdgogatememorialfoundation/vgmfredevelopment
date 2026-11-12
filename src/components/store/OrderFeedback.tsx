"use client";

import { useEffect, useState } from "react";

type Feedback = {
  delivery?: { rating: number; comment: string };
  products: { bookId: string; title: string; rating: number; comment: string }[];
  updatedAt: string;
};
type Data = { ok?: boolean; feedback: Feedback | null; canRate: boolean; pickup: boolean; items: { bookId: string; title: string }[] };

function Stars({ value, onChange }: { value: number; onChange?: (value: number) => void }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(star)}
          className={`text-2xl leading-none ${star <= value ? "text-amber-500" : "text-slate-300"} ${onChange ? "cursor-pointer" : "cursor-default"}`}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

/** Delivery experience and product ratings, shown only under this order (customer and desk). */
export default function OrderFeedback({ orderId, readOnly = false }: { orderId: string; readOnly?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [delivery, setDelivery] = useState({ rating: 0, comment: "" });
  const [products, setProducts] = useState<Record<string, { rating: number; comment: string }>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/shop/order-feedback?order=${encodeURIComponent(orderId)}`, { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<Data>) : null))
      .then((next) => {
        if (cancelled || !next) return;
        setData(next);
        if (next.feedback?.delivery) setDelivery(next.feedback.delivery);
        setProducts(Object.fromEntries((next.feedback?.products ?? []).map((row) => [row.bookId, { rating: row.rating, comment: row.comment }])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (!data || (!data.canRate && !data.feedback)) return null;
  const editable = data.canRate && !readOnly;
  const label = data.pickup ? "Store pickup experience" : "Delivery experience";

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/shop/order-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order: orderId, delivery, products: Object.entries(products).map(([bookId, row]) => ({ bookId, ...row })) }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string; feedback?: Feedback };
      if (!response.ok || !result.feedback) throw new Error(result.error || "Could not save your rating.");
      setData((prev) => (prev ? { ...prev, feedback: result.feedback ?? null } : prev));
      setMessage("Thank you. Your rating is saved with this order.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="feedback" className="mt-6 rounded-xl border border-border bg-white p-5">
      <h2 className="font-serif text-xl text-ink">{editable ? "Rate this order" : "Customer rating for this order"}</h2>
      <div className="mt-4 space-y-4 text-sm">
        <div>
          <p className="font-semibold text-text-primary">{label}</p>
          <Stars value={delivery.rating} onChange={editable ? (rating) => setDelivery({ ...delivery, rating }) : undefined} />
          {editable ? (
            <textarea className="mt-2 w-full rounded-lg border border-border p-2" rows={2} placeholder="Anything about the packing or delivery (optional)" value={delivery.comment} onChange={(event) => setDelivery({ ...delivery, comment: event.target.value })} />
          ) : delivery.comment ? (
            <p className="mt-1 text-text-muted">{delivery.comment}</p>
          ) : null}
        </div>
        {data.items.map((item) => {
          const row = products[item.bookId] ?? { rating: 0, comment: "" };
          if (!editable && !row.rating) return null;
          return (
            <div key={item.bookId}>
              <p className="font-semibold text-text-primary">{item.title}</p>
              <Stars value={row.rating} onChange={editable ? (rating) => setProducts({ ...products, [item.bookId]: { ...row, rating } }) : undefined} />
              {editable ? (
                <textarea className="mt-2 w-full rounded-lg border border-border p-2" rows={2} placeholder="Your comments on this product (optional)" value={row.comment} onChange={(event) => setProducts({ ...products, [item.bookId]: { ...row, comment: event.target.value } })} />
              ) : row.comment ? (
                <p className="mt-1 text-text-muted">{row.comment}</p>
              ) : null}
            </div>
          );
        })}
        {editable ? (
          <button type="button" disabled={busy} onClick={() => void submit()} className="rounded-full bg-burgundy px-5 py-2.5 font-semibold text-white disabled:opacity-60">
            {busy ? "Saving…" : data.feedback ? "Update rating" : "Submit rating"}
          </button>
        ) : null}
        {message ? <p className="text-text-muted">{message}</p> : null}
      </div>
    </section>
  );
}
