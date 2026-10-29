"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addToCart,
  getEstimatedDeliveryDate,
  isInWishlist,
  toggleWishlist,
} from "@/lib/store";
import { addStockAlert, canOrder, canPreorder, isPurchasable } from "@/lib/product-data";
import { checkPincode, getPickupLocation, type DeliveryQuote } from "@/lib/fulfillment";
import { useAuth } from "@/components/auth/AuthContext";
import type { Book } from "@/types";

export default function ProductBuyBox({ book }: { book: Book }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [pincode, setPincode] = useState("");
  const [estimate, setEstimate] = useState<DeliveryQuote | null>(null);
  const [checked, setChecked] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyNote, setNotifyNote] = useState("");

  const stock = estimate?.stock ?? book.stock ?? 0;
  const purchasable = isPurchasable({ ...book, stock });
  const preorder = canPreorder({ ...book, stock });
  const orderable = canOrder({ ...book, stock });
  const pickup = getPickupLocation();
  const nextUrl = `/shop/${book.slug}`;

  const requireAccount = (then: () => void) => {
    if (!isAuthenticated) {
      router.push(`/login?mode=signin&next=${encodeURIComponent(nextUrl)}`);
      return;
    }
    then();
  };

  const handleAddToCart = () => {
    requireAccount(() => {
      addToCart(book.id, quantity);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 3000);
    });
  };

  const handleBuyNow = () => {
    requireAccount(() => {
      addToCart(book.id, quantity);
      router.push(`/checkout?buyNow=${book.id}&qty=${quantity}`);
    });
  };

  const checkDelivery = () => {
    setEstimate(checkPincode(pincode, book.id, quantity));
    setChecked(true);
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      {/* Price */}
      <div className="flex flex-wrap items-end gap-3">
        <p className="text-2xl font-semibold text-text-primary">
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
            purchasable ? "bg-emerald-500" : preorder ? "bg-amber-500" : "bg-red-500"
          }`}
        />
        <span className={purchasable ? "text-emerald-700" : preorder ? "text-burgundy" : "text-red-600"}>
          {purchasable ? book.availability : preorder ? "Pre-order" : "Out of stock"}
        </span>
        {purchasable && (
          <span className="text-text-muted">· {stock} in stock at {estimate?.stockingLocation ?? "the Foundation store"}</span>
        )}
        {preorder && book.preorder?.releaseDate && (
          <span className="text-text-muted">· expected {book.preorder.releaseDate}</span>
        )}
      </p>

      <div className="mt-4 rounded-xl border border-gold/40 bg-warm-cream p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-text-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17h14V7H5z" />
            <path d="M5 17V3H3" />
            <path d="M14 17v3h3" />
            <circle cx="7" cy="17" r="1.5" />
            <circle cx="17" cy="17" r="1.5" />
          </svg>
          Expected delivery:
          <span className="font-semibold">
            {estimate?.deliverBy
              ? estimate.deliverBy
              : estimate && checked
                ? "Confirmed after a courier is booked"
                : "Check your pincode"}
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            aria-label="Delivery pincode"
            placeholder="Enter pincode"
            value={pincode}
            onChange={(e) => {
              setPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setChecked(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") checkDelivery();
            }}
            className="input-field py-2.5"
          />
          <button
            type="button"
            onClick={checkDelivery}
            className="btn-secondary shrink-0 px-4 py-2.5 text-xs"
          >
            Check
          </button>
        </div>

        {checked && estimate?.serviceable && (
          <div className="mt-3 rounded-lg bg-white p-3 text-xs">
            {estimate.courier && estimate.deliverBy ? (
              <p className="font-semibold text-text-primary">
                Deliverable to {estimate.pincode} by {estimate.deliverBy} via {estimate.courier}
              </p>
            ) : (
              <p className="font-semibold text-text-primary">
                Deliverable to {estimate.pincode}. A courier date appears after a shipping API is connected.
              </p>
            )}
            <ul className="mt-2 space-y-1 text-text-muted">
              <li>Order date: {estimate.orderDate}</li>
              <li>
                Processing and packing: {estimate.processingDays} business day
                {estimate.processingDays === 1 ? "" : "s"} · dispatch {estimate.dispatchBy}
              </li>
              {estimate.courier ? (
                <li>
                  {estimate.courier} transit: {estimate.transitDays} business day
                  {estimate.transitDays === 1 ? "" : "s"}
                </li>
              ) : null}
            </ul>
            {estimate.offers.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-border pt-2 text-text-muted">
                {estimate.offers.slice(0, 4).map((offer) => (
                  <li key={offer.id}>
                    {offer.name}: {offer.deliverBy}
                  </li>
                ))}
              </ul>
            )}
            {estimate.note && <p className="mt-2 text-text-muted">{estimate.note}</p>}
          </div>
        )}
        {checked && estimate && !estimate.serviceable && (
          <p className={`mt-2 text-xs ${estimate.pickupAvailable ? "text-text-muted" : "text-red-700"}`}>{estimate.note}</p>
        )}

        <div className="mt-3 rounded-lg border border-border bg-white p-3 text-xs">
          <p className="font-semibold text-text-primary">Pickup from store</p>
          {(estimate ? estimate.pickupAvailable : book.storePickupAvailable !== false) ? (
            <p className="mt-1 text-text-muted">
              Collect from {pickup.name}, {pickup.address}
              {estimate ? ` · ready ${estimate.pickupReadyBy}, held until ${estimate.pickupHoldUntil}` : ""}.
            </p>
          ) : (
            <p className="mt-1 text-text-muted">Store pickup is not offered for this product.</p>
          )}
        </div>
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
              onClick={() => setQuantity((q) => Math.min(purchasable ? stock : 20, q + 1))}
              className="flex h-11 w-11 items-center justify-center text-text-primary transition hover:text-burgundy"
            >
              +
            </button>
          </div>
          <p className="text-sm text-text-muted">
            {purchasable ? `${stock} in stock` : preorder ? "Pre-order" : "Currently unavailable"}
          </p>
        </div>

        {!isAuthenticated && (
          <p className="mt-4 rounded-xl border border-border bg-warm-cream px-3 py-2 text-xs text-text-muted">
            Sign in or register to add this to your cart and place an order.{" "}
            <Link href={`/login?mode=signin&next=${encodeURIComponent(nextUrl)}`} className="font-semibold text-burgundy">Sign in</Link>
            {" · "}
            <Link href={`/login?next=${encodeURIComponent(nextUrl)}`} className="font-semibold text-burgundy">Create account</Link>
          </p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!orderable}
            onClick={handleAddToCart}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {added ? (
              <span className="flex items-center gap-2 text-emerald-700">
                ✓ Added to Cart
              </span>
            ) : preorder ? (
              "Add pre-order"
            ) : (
              "Add to Cart"
            )}
          </button>
          <button
            type="button"
            disabled={!orderable}
            onClick={handleBuyNow}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {preorder ? "Pre-order now" : "Buy Now"}
          </button>
        </div>

        {!orderable && (
          <form
            className="mt-4 rounded-xl border border-border bg-warm-cream p-3"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                addStockAlert(book.id, notifyEmail || user?.email || "", user ? `${user.firstName} ${user.lastName}` : undefined);
                setNotifyNote("We will email you when this is back in stock.");
              } catch (problem) {
                setNotifyNote(problem instanceof Error ? problem.message : "Could not save the alert.");
              }
            }}
          >
            <p className="text-sm font-semibold text-text-primary">Email me when it is back</p>
            <div className="mt-2 flex gap-2">
              <input
                className="input-field py-2"
                type="email"
                required
                placeholder="you@email.com"
                value={notifyEmail || user?.email || ""}
                onChange={(event) => setNotifyEmail(event.target.value)}
              />
              <button type="submit" className="btn-outline shrink-0 px-3 py-2 text-xs">Notify me</button>
            </div>
            {notifyNote && <p className="mt-2 text-xs text-emerald-700">{notifyNote}</p>}
          </form>
        )}

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