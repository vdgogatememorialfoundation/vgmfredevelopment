"use client";

import { useState } from "react";
import Glyph from "@/components/store/Glyph";
import { useAuth } from "@/components/auth/AuthContext";
import { brandLabel, cardBrand, makeDefaultCard, removeCard, saveCard, useSavedCards, type SavedCard } from "@/lib/account-wallet";

export default function SavedCards() {
  const { user } = useAuth();
  const cards = useSavedCards(user?.email);
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  if (!user) return null;

  const reset = () => {
    setNumber("");
    setExpiry("");
    setName("");
    setError("");
    setOpen(false);
  };

  const save = () => {
    const result = saveCard(user.email, { number, expiry, name });
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    reset();
  };

  const digits = number.replace(/\D/g, "");
  const last4 = digits.slice(-4);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="heading-3">My Saved Cards</h1>
          <p className="mt-2 max-w-xl text-sm text-text-muted">Only the brand and last four digits are kept. The full number and CVV are not stored.</p>
        </div>
        <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => { setOpen(true); setError(""); }}>
          <Glyph name="plus" className="h-4 w-4" />
          Add card
        </button>
      </div>

      {open && (
        <div className="mb-5 grid gap-5 rounded-2xl border border-border bg-white p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Glyph name="card" className="h-4 w-4 text-burgundy" />
              New card
            </div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="card-number">Card number</label>
            <input
              id="card-number"
              inputMode="numeric"
              autoComplete="cc-number"
              className="input-field"
              placeholder="1234 5678 9012 3456"
              value={number}
              onChange={(event) => setNumber(event.target.value.replace(/[^\d ]/g, "").slice(0, 23))}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="card-expiry">Expiry</label>
                <input
                  id="card-expiry"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  className="input-field"
                  placeholder="MM/YY"
                  value={expiry}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
                    setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
                  }}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="card-name">Name on card</label>
                <input id="card-name" autoComplete="cc-name" className="input-field" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
            </div>
            <p className="mt-3 text-xs text-text-muted">The number is checked, then discarded. A CVV is never asked for here.</p>
            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={save}>Save card</button>
              <button type="button" className="btn-outline" onClick={reset}>Cancel</button>
            </div>
          </div>
          <CardFace brand={brandLabel(cardBrand(digits))} last4={last4 || "••••"} name={name || "Name on card"} expiry={expiry || "MM/YY"} />
        </div>
      )}

      {cards.length === 0 && !open && (
        <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warm-cream text-burgundy">
            <Glyph name="card" className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-semibold text-text-primary">No saved cards</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">Add a card to see it at checkout. Payment still opens the secure payment window.</p>
          <button type="button" className="btn-primary mt-6 inline-flex items-center gap-2" onClick={() => setOpen(true)}>
            <Glyph name="plus" className="h-4 w-4" />
            Add card
          </button>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.id} className="space-y-3">
            <CardFace brand={brandLabel(card.brand)} last4={card.last4} name={card.name} expiry={card.expiry} />
            <div className="flex flex-wrap items-center gap-3 px-1 text-xs font-semibold">
              {card.isDefault ? (
                <span className="rounded-full bg-burgundy/10 px-2 py-0.5 uppercase tracking-wide text-burgundy">Default</span>
              ) : (
                <button type="button" className="text-burgundy" onClick={() => makeDefaultCard(user.email, card.id)}>Make default</button>
              )}
              <button type="button" className="inline-flex items-center gap-1 text-red-700" onClick={() => removeCard(user.email, card.id)}>
                <Glyph name="trash" className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CardFace({ brand, last4, name, expiry }: { brand: string; last4: string; name: string; expiry: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-burgundy px-5 py-5 text-white shadow-sm">
      <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10" />
      <div className="absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative flex items-center justify-between">
        <Glyph name="card" className="h-6 w-6" />
        <span className="text-xs font-semibold uppercase tracking-[0.16em]">{brand}</span>
      </div>
      <p className="relative mt-8 font-mono text-lg tracking-[0.18em]">•••• •••• •••• {last4}</p>
      <div className="relative mt-4 flex items-end justify-between text-xs">
        <span className="max-w-[70%] truncate uppercase tracking-wide">{name}</span>
        <span>{expiry}</span>
      </div>
    </div>
  );
}

export function SavedCardTiles({
  cards,
  selectedId,
  onSelect,
}: {
  cards: SavedCard[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (!cards.length) return null;
  return (
    <div className="mt-4 grid gap-2">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onSelect(card.id)}
          className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left ${selectedId === card.id ? "border-burgundy bg-burgundy/5" : "border-border bg-white"}`}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warm-cream text-burgundy">
            <Glyph name="card" className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">{brandLabel(card.brand)} ···· {card.last4}</span>
            <span className="block text-xs text-text-muted">{card.name} · {card.expiry}{card.isDefault ? " · default" : ""}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
