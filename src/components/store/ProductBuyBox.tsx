"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addToCart,
  getEstimatedDeliveryDate,
  getDeliveryEstimateForPincode,
  daysFromNow,
  isInWishlist,
  toggleWishlist,
} from "@/lib/store";
import { formatDate } from "@/lib/utils";
import type { Book } from "@/types";

export default function ProductBuyBox({ book }: { book: Book }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [pincode, setPincode] = useState("");
  const [estimate, setEstimate] = useState<
    ReturnType<typeof getDeliveryEstimateForPincode> | null
  >(null);
  const [checked, setChecked] = useState(false);

  const stock = book.stock ?? 0;
  const inStock = stock > 0;

  const handleAddToCart = () => {
    addToCart(book.id, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 3000);
  };

  const handleBuyNow = () => {
    addToCart(book.id, quantity);
    router.push(`/checkout?buyNow=${book.id}&qty=${quantity}`);
  };

  const checkPincode = () => {
    const result = getDeliveryEstimateForPincode(pincode);
    setEstimate(result);
    setChecked(true);
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      {/* Price */}
      <div className="flex flex-wrap items-end gap-3">
        <p className="text-3xl font-bold text-text-primary">
          ₹{(book.price * quantity).toLocaleString("en-IN")}
        </p>
        {book.originalPrice && book.originalPrice > book.price && (
          <>
            <p className="text-lg text-text-muted line-through">
              ₹{book.originalPrice.toLocaleString("en-IN")}
            </p>
            <p className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
              {Math.round(((book.originalPrice - book.price) / book.originalPrice) * 100)}% OFF
            </p>
          </>
        )}
      </div>

      {book.originalPrice && book.originalPrice > book.price && (
        <p className="mt-1.5 text-xs text-emerald-700">
          You save ₹
          {((book.originalPrice - book.price) * quantity).toLocaleString("en-IN")}
          {" "}on the selling price · taxes computed at checkout
        </p>
      )}

      {/* Availability */}
      <p className="mt-4 flex items-center gap-2 text-sm">
        <span
          className={`h-2 w-2 rounded-full ${
            inStock ? "bg-emerald-500" : "bg-red-500"
          }`}
        />
        <span className={inStock ? "text-emerald-700" : "text-red-600"}>
          {book.availability}
        </span>
        <span className="text-text-muted">· {book.stock} copies available</span>
      </p>

      {/* Delivery */}
      <div className="mt-4 rounded-xl border border-border bg-warm-cream p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-text-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17h14V7H5z" />
            <path d="M5 17V3H3" />
            <path d="M14 17v3h3" />
            <circle cx="7" cy="17" r="1.5" />
            <circle cx="17" cy="17" r="1.5" />
          </svg>
          Estimated delivery:
          <span className="font-semibold">
            {estimate?.serviceable
              ? `by ${estimate.to}`
              : getEstimatedDeliveryDate(6)}
          </span>
        </div>

        {/* Pincode checker */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            aria-label="Delivery pincode"
            placeholder="Enter pincode for exact delivery dates"
            value={pincode}
            onChange={(e) =>
              setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") checkPincode();
            }}
            className="input-field py-2.5"
          />
          <button
            type="button"
            onClick={checkPincode}
            className="btn-secondary shrink-0 px-4 py-2.5 text-xs"
          >
            Check
          </button>
        </div>

        {checked && estimate?.serviceable && (
          <div className="mt-2 rounded-lg bg-white p-3 text-xs">
            <p className="font-semibold text-text-primary">
              Deliverable to {estimate.pincode} · arrives{" "}
              {estimate.to}
            </p>
            <ul className="mt-1.5 space-y-1 text-text-muted">
              <li>
                Order placed today, {formatDate(daysFromNow(0))}
              </li>
              <li>
                Order processing (packing & dispatch):{" "}
                {estimate.processingDays} business day
                {estimate.processingDays === 1 ? "" : "s"}
              </li>
              <li>
                Shipping timeline: {estimate.transitDays} business day
                {estimate.transitDays === 1 ? "" : "s"}
              </li>
            </ul>
          </div>
        )}
        {checked && estimate && !estimate.serviceable && (
          <p className="mt-2 text-xs text-red-600">{estimate.note}</p>
        )}

        <p className="mt-3 text-xs text-text-muted">
          {book.expectedDelivery} · Estimate calculated from order processing
          time + shipping timeline.
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="font-medium text-text-primary">Availability:</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {book.deliveryAvailable ? "Home delivery" : "Delivery unavailable"}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-burgundy" />
            {book.storePickupAvailable
              ? "Store pickup available"
              : "Store pickup unavailable"}
          </span>
        </div>
        {book.storePickupAvailable && (
          <p className="mt-1 text-xs text-text-muted">
            Pick up from Vaidya Gogate Memorial Foundation, Pune within 2–3
            business days of order confirmation.
          </p>
        )}
      </div>

      {/* Quantity + actions */}
      <div className="mt-5">
        <p className="mb-2 text-sm font-semibold text-text-primary">Quantity</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-xl border border-border">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-11 w-11 items-center justify-center text-text-primary transition hover:text-burgundy"
            >
              −
            </button>
            <span className="w-10 text-center font-semibold">{quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
              className="flex h-11 w-11 items-center justify-center text-text-primary transition hover:text-burgundy"
            >
              +
            </button>
          </div>
          <p className="text-sm text-text-muted">
            {stock} in stock
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!inStock}
            onClick={handleAddToCart}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {added ? (
              <span className="flex items-center gap-2 text-emerald-700">
                ✓ Added to Cart
              </span>
            ) : (
              "Add to Cart"
            )}
          </button>
          <button
            type="button"
            disabled={!inStock}
            onClick={handleBuyNow}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Buy Now
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            toggleWishlist(book.id);
            setWishlisted(isInWishlist(book.id));
          }}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm font-semibold transition hover:border-burgundy ${
            wishlisted ? "text-burgundy" : "text-text-muted hover:text-burgundy"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
          </svg>
          {wishlisted ? "Added to Wishlist" : "Add to Wishlist"}
        </button>
      </div>

      {added && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="font-semibold text-emerald-800">
            {book.title} added to cart
          </p>
          <p className="mt-1 text-emerald-700">
            Estimated delivery: {getEstimatedDeliveryDate(6)}.
          </p>
          <Link
            href="/cart"
            className="mt-2 inline-flex font-semibold text-emerald-800 underline"
          >
            View Cart & Checkout →
          </Link>
        </div>
      )}
    </div>
  );
}