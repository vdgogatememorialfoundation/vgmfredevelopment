"use client";

import { useEffect, useState } from "react";
import { ImageField } from "@/components/admin/ImageField";
import { getAllProducts } from "@/lib/product-data";
import {
  deleteProductReview,
  deleteSeminarReview,
  hideProductReview,
  hydrateReviewsFromServer,
  replyToProductReview,
  saveSeminarReview,
  useAllProductReviews,
  useAllSeminarReviews,
  type SeminarReview,
} from "@/lib/reviews";

const field = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const button = "rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white";
const ghost = "rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700";
const card = "space-y-4 rounded-xl border border-slate-200 bg-white p-5";

export function ReviewsDesk() {
  const [tab, setTab] = useState<"seminar" | "product">("seminar");
  useEffect(() => {
    void hydrateReviewsFromServer();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reviews</h1>
        <p className="mt-1 text-sm text-slate-500">
          Seminar voices appear in the homepage slider. Product reviews are written by people who bought a title; you can reply from here.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["seminar", "product"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === item ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600"}`}
          >
            {item === "seminar" ? "Seminar reviews" : "Product reviews"}
          </button>
        ))}
      </div>
      {tab === "seminar" ? <SeminarPanel /> : <ProductPanel />}
    </div>
  );
}

function SeminarPanel() {
  const rows = useAllSeminarReviews();
  const [draft, setDraft] = useState<Partial<SeminarReview>>({ rating: 5, published: true });
  const [note, setNote] = useState("");

  const reset = () => setDraft({ rating: 5, published: true });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <form
        className={card}
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name?.trim() || !draft.text?.trim()) {
            setNote("Add the participant’s name and their review.");
            return;
          }
          saveSeminarReview({
            id: draft.id,
            name: draft.name,
            event: draft.event || "Seminar",
            rating: draft.rating ?? 5,
            text: draft.text,
            date: draft.date,
            photo: draft.photo,
            published: draft.published !== false,
          });
          setNote(draft.id ? "Seminar review updated." : "Seminar review added to the homepage slider.");
          reset();
        }}
      >
        <p className="font-semibold text-slate-900">{draft.id ? "Edit seminar review" : "Add seminar review"}</p>
        <input className={field} placeholder="Name" value={draft.name ?? ""} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
        <input className={field} placeholder="Seminar or programme" value={draft.event ?? ""} onChange={(event) => setDraft((current) => ({ ...current, event: event.target.value }))} />
        <input className={field} type="number" min={1} max={5} value={draft.rating ?? 5} onChange={(event) => setDraft((current) => ({ ...current, rating: Number(event.target.value) }))} />
        <textarea className={field} rows={4} placeholder="Their view of the seminar" value={draft.text ?? ""} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} />
        <ImageField label="Photo (optional)" value={draft.photo} onChange={(photo) => setDraft((current) => ({ ...current, photo }))} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={draft.published !== false} onChange={(event) => setDraft((current) => ({ ...current, published: event.target.checked }))} />
          Show on the homepage slider
        </label>
        {note ? <p className="text-sm text-burgundy">{note}</p> : null}
        <div className="flex gap-2">
          <button type="submit" className={button}>{draft.id ? "Save" : "Add review"}</button>
          {draft.id ? (
            <button type="button" className={ghost} onClick={reset}>
              New
            </button>
          ) : null}
        </div>
      </form>

      <div className="space-y-3">
        {rows.length === 0 ? <p className="text-sm text-slate-500">No seminar reviews yet.</p> : null}
        {rows.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{item.event} · {item.rating}/5 {item.published ? "· Live" : "· Hidden"}</p>
              </div>
              <div className="flex gap-2 text-xs font-semibold">
                <button type="button" className="text-burgundy" onClick={() => setDraft(item)}>Edit</button>
                <button type="button" className="text-red-600" onClick={() => deleteSeminarReview(item.id)}>Remove</button>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-700">{item.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProductPanel() {
  const rows = useAllProductReviews();
  const products = getAllProducts();
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3">
      {note ? <p className="text-sm text-burgundy">{note}</p> : null}
      {rows.length === 0 ? <p className="text-sm text-slate-500">No product reviews yet. They appear when a purchaser writes one on the product page.</p> : null}
      {rows.map((item) => {
        const product = products.find((book) => book.id === item.productId);
        return (
          <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {product?.title || item.productId} · {item.rating}/5 · {item.email}
                  {item.hidden ? " · Hidden" : ""}
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-burgundy"
                onClick={() => {
                  hideProductReview(item.id, !item.hidden);
                  setNote(item.hidden ? "Review is visible again." : "Review hidden from the product page.");
                }}
              >
                {item.hidden ? "Show" : "Hide"}
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-700">{item.text}</p>
            {item.reply?.text ? (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-semibold">Reply: </span>
                {item.reply.text}
              </p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                className={field}
                placeholder="Reply to this purchaser"
                value={replies[item.id] ?? item.reply?.text ?? ""}
                onChange={(event) => setReplies((current) => ({ ...current, [item.id]: event.target.value }))}
              />
              <button
                type="button"
                className={button}
                onClick={() => {
                  const text = (replies[item.id] ?? item.reply?.text ?? "").trim();
                  if (!text) {
                    setNote("Write a reply first.");
                    return;
                  }
                  replyToProductReview(item.id, text);
                  setNote("Reply published on the product page.");
                }}
              >
                Reply
              </button>
              <button type="button" className={ghost} onClick={() => deleteProductReview(item.id)}>
                Delete
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
