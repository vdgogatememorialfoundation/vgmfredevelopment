"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAllProducts } from "@/lib/use-cms";
import { saveProduct } from "@/lib/product-data";
import { offerActive } from "@/lib/promotions";
import { fromDatetimeLocal, toDatetimeLocal } from "@/lib/schedule";
import type { Coupon, GiftCard } from "@/lib/server/promotions";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const label = "text-xs font-semibold text-slate-600";
const card = "rounded-xl border border-slate-200 bg-white p-5";

const blankCoupon = (): Coupon => ({ code: "", label: "", type: "percent", value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, used: 0, allowPreorder: false, active: true });

export default function PromotionsDesk() {
  const products = useAllProducts();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [nextCode, setNextCode] = useState("");
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [category, setCategory] = useState("");
  const [percent, setPercent] = useState(10);
  const [offerLabel, setOfferLabel] = useState("");
  const [offerEnds, setOfferEnds] = useState("");

  useEffect(() => {
    fetch("/api/shop/promotions", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { ok?: boolean; coupons?: Coupon[]; giftCards?: GiftCard[]; newCode?: string; error?: string }) => {
        if (!data.ok) return setNote(data.error || "Could not load promotions.");
        setCoupons(data.coupons ?? []);
        setCards(data.giftCards ?? []);
        setNextCode(data.newCode ?? "");
        setLoaded(true);
      })
      .catch(() => setNote("Could not load promotions."));
  }, []);

  const save = async (next: { coupons?: Coupon[]; giftCards?: GiftCard[] }) => {
    const response = await fetch("/api/shop/promotions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save", ...next }) }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { ok?: boolean; coupons?: Coupon[]; giftCards?: GiftCard[]; error?: string } | null;
    if (!data?.ok) return setNote(data?.error || "Could not save.");
    setCoupons(data.coupons ?? []);
    setCards(data.giftCards ?? []);
    setNote("Saved ✓");
  };

  const categories = Array.from(new Set(products.map((book) => book.category).filter(Boolean))).sort();
  const onOffer = products.filter((book) => book.offer);

  const applyCategoryOffer = () => {
    const targets = products.filter((book) => !category || book.category === category);
    if (!targets.length || percent <= 0 || percent >= 100) return setNote("Pick a category and a discount between 1 and 99%.");
    if (!window.confirm(`Put ${percent}% off on ${targets.length} product(s)?`)) return;
    for (const book of targets) {
      saveProduct({ ...book, offer: { price: Math.round(book.price * (100 - percent)) / 100, label: offerLabel || `${percent}% off`, endsAt: fromDatetimeLocal(offerEnds) }, updatedAt: new Date().toISOString() });
    }
    setNote(`Offer set on ${targets.length} product(s). Publish the catalogue from Products if your site needs it.`);
  };

  const setCoupon = (index: number, patch: Partial<Coupon>) => setCoupons((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const setCard = (index: number, patch: Partial<GiftCard>) => setCards((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Offers, coupons & gift cards</h1>
        <p className="mt-1 text-sm text-slate-500">Product offers show on product cards and pages. Coupons and gift cards are entered by customers at checkout and checked on the server.</p>
        {note ? <p className="mt-2 text-sm font-semibold text-emerald-700">{note}</p> : null}
      </div>

      <section className={card}>
        <h2 className="text-lg font-semibold text-slate-900">Product offers</h2>
        <p className="mt-1 text-sm text-slate-500">Set one product&apos;s offer in <Link className="text-burgundy underline" href="/admin/commerce/products">Product Management</Link> → edit → Offer, or put a % off on a whole category here.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          <label><span className={label}>Category</span><select className={input} value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All products</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label><span className={label}>% off</span><input className={input} type="number" min={1} max={99} value={percent} onChange={(event) => setPercent(Number(event.target.value))} /></label>
          <label><span className={label}>Label</span><input className={input} value={offerLabel} placeholder={`${percent}% off`} onChange={(event) => setOfferLabel(event.target.value)} /></label>
          <label><span className={label}>Ends</span><input className={input} type="datetime-local" value={offerEnds} onChange={(event) => setOfferEnds(event.target.value)} /></label>
          <button type="button" onClick={applyCategoryOffer} className="self-end rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white">Apply offer</button>
        </div>
        <table className="mt-5 w-full text-left text-sm">
          <thead className="text-xs text-slate-500"><tr><th className="py-2">Product</th><th>Price</th><th>Offer</th><th>Ends</th><th>Status</th><th /></tr></thead>
          <tbody>
            {onOffer.map((book) => (
              <tr key={book.id} className="border-t border-slate-100">
                <td className="py-2">{book.title}</td>
                <td>₹{book.price}</td>
                <td>₹{book.offer?.price} · {book.offer?.label || "Special offer"}</td>
                <td>{book.offer?.endsAt ? new Date(book.offer.endsAt).toLocaleString("en-IN") : "No end"}</td>
                <td>{offerActive(book) ? <span className="text-emerald-700">Running</span> : <span className="text-slate-500">Not running</span>}</td>
                <td><button type="button" className="text-xs font-semibold text-red-700 underline" onClick={() => saveProduct({ ...book, offer: undefined, updatedAt: new Date().toISOString() })}>Remove</button></td>
              </tr>
            ))}
            {!onOffer.length ? <tr><td colSpan={6} className="py-3 text-slate-500">No product offers yet.</td></tr> : null}
          </tbody>
        </table>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Coupons & discount codes</h2>
          <button type="button" disabled={!loaded} onClick={() => setCoupons((rows) => [...rows, blankCoupon()])} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold">+ Add coupon</button>
        </div>
        <div className="mt-4 space-y-3">
          {coupons.map((coupon, index) => (
            <div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-6">
              <label><span className={label}>Code</span><input className={`${input} uppercase`} value={coupon.code} onChange={(event) => setCoupon(index, { code: event.target.value })} /></label>
              <label><span className={label}>Name shown</span><input className={input} value={coupon.label} onChange={(event) => setCoupon(index, { label: event.target.value })} /></label>
              <label><span className={label}>Discount</span><div className="flex gap-1"><select className={input} value={coupon.type} onChange={(event) => setCoupon(index, { type: event.target.value === "flat" ? "flat" : "percent" })}><option value="percent">%</option><option value="flat">₹</option></select><input className={input} type="number" min={0} value={coupon.value} onChange={(event) => setCoupon(index, { value: Number(event.target.value) })} /></div></label>
              <label><span className={label}>Min. order ₹</span><input className={input} type="number" min={0} value={coupon.minOrder} onChange={(event) => setCoupon(index, { minOrder: Number(event.target.value) })} /></label>
              <label><span className={label}>Max discount ₹ (0 = none)</span><input className={input} type="number" min={0} value={coupon.maxDiscount} onChange={(event) => setCoupon(index, { maxDiscount: Number(event.target.value) })} /></label>
              <label><span className={label}>Uses (limit 0 = unlimited)</span><input className={input} type="number" min={0} value={coupon.usageLimit} onChange={(event) => setCoupon(index, { usageLimit: Number(event.target.value) })} /><span className="text-xs text-slate-500">Used {coupon.used}</span></label>
              <label><span className={label}>Starts</span><input className={input} type="datetime-local" value={toDatetimeLocal(coupon.startsAt)} onChange={(event) => setCoupon(index, { startsAt: fromDatetimeLocal(event.target.value) })} /></label>
              <label><span className={label}>Ends</span><input className={input} type="datetime-local" value={toDatetimeLocal(coupon.endsAt)} onChange={(event) => setCoupon(index, { endsAt: fromDatetimeLocal(event.target.value) })} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={coupon.allowPreorder} onChange={(event) => setCoupon(index, { allowPreorder: event.target.checked })} /> Pre-orders too</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={coupon.active} onChange={(event) => setCoupon(index, { active: event.target.checked })} /> Active</label>
              <button type="button" className="text-left text-xs font-semibold text-red-700 underline" onClick={() => setCoupons((rows) => rows.filter((_, i) => i !== index))}>Delete</button>
            </div>
          ))}
          {!coupons.length ? <p className="text-sm text-slate-500">No coupons yet.</p> : null}
        </div>
        <button type="button" disabled={!loaded} onClick={() => save({ coupons })} className="mt-4 rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save coupons</button>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Gift cards</h2>
          <button
            type="button"
            disabled={!loaded}
            onClick={async () => {
              setCards((rows) => [...rows, { code: nextCode, initial: 500, balance: 500, active: true, createdAt: new Date().toISOString(), history: [] }]);
              const data = (await fetch("/api/shop/promotions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "new-code" }) }).then((r) => r.json()).catch(() => null)) as { code?: string } | null;
              setNextCode(data?.code ?? "");
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold"
          >
            + Issue gift card
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {cards.map((giftCard, index) => (
            <div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-6">
              <label className="sm:col-span-2"><span className={label}>Code (give this to the customer)</span><input className={`${input} font-mono uppercase`} value={giftCard.code} onChange={(event) => setCard(index, { code: event.target.value })} /></label>
              <label><span className={label}>Value ₹</span><input className={input} type="number" min={0} value={giftCard.initial} onChange={(event) => setCard(index, { initial: Number(event.target.value), balance: giftCard.history.length ? giftCard.balance : Number(event.target.value) })} /></label>
              <label><span className={label}>Balance ₹</span><input className={input} type="number" min={0} value={giftCard.balance} onChange={(event) => setCard(index, { balance: Number(event.target.value) })} /></label>
              <label><span className={label}>Issued to</span><input className={input} value={giftCard.issuedTo ?? ""} placeholder="Name or email" onChange={(event) => setCard(index, { issuedTo: event.target.value })} /></label>
              <label><span className={label}>Expires</span><input className={input} type="datetime-local" value={toDatetimeLocal(giftCard.endsAt)} onChange={(event) => setCard(index, { endsAt: fromDatetimeLocal(event.target.value) })} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={giftCard.active} onChange={(event) => setCard(index, { active: event.target.checked })} /> Active</label>
              <p className="text-xs text-slate-500 sm:col-span-4">{giftCard.history.length ? giftCard.history.map((use) => `₹${use.amount} on ${use.orderId}`).join(" · ") : "Not used yet"}</p>
              <button type="button" className="text-left text-xs font-semibold text-red-700 underline" onClick={() => setCards((rows) => rows.filter((_, i) => i !== index))}>Delete</button>
            </div>
          ))}
          {!cards.length ? <p className="text-sm text-slate-500">No gift cards yet.</p> : null}
        </div>
        <button type="button" disabled={!loaded} onClick={() => save({ giftCards: cards })} className="mt-4 rounded-lg bg-burgundy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save gift cards</button>
      </section>
    </div>
  );
}
