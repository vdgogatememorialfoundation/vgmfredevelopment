"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SectionHeader from "@/components/account/SectionHeader";
import EmptyState from "@/components/account/EmptyState";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import OrderTrackingTimeline from "@/components/store/OrderTrackingTimeline";
import ReturnSection from "@/components/store/ReturnSection";
import { useAuth } from "@/components/auth/AuthContext";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { getOrdersForAccount, formatPrice, purgeSampleOrders } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { isHyperlocalProvider } from "@/lib/order-pipeline";
import { customerAddressLine, deliveryExpectation } from "@/lib/delivery-expectation";
import { getShipments } from "@/lib/admin-store";
import type { Order } from "@/types";

function latestStatusText(order: Order) {
  const shipment = getShipments().find((item) => item.orderId === order.id && item.note !== "Cancelled");
  return deliveryExpectation(order.status, shipment?.expectedBy || order.eta);
}

export default function OrdersPage() {
  const { user } = useAuth();
  const { ready, version } = useCommerceMirror();
  const [mounted, setMounted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    purgeSampleOrders();
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const orders = mounted && ready ? getOrdersForAccount(user) : [];
  void version;

  return (
    <div>
      <SectionHeader
        title="My Orders"
        description="Tap an order card to view live tracking, delivery details and, if an item arrived damaged, a replacement request."
      />

      {mounted && !ready ? (
        <p className="text-sm text-text-muted">Loading your orders…</p>
      ) : mounted && orders.length === 0 ? (
        <EmptyState
          title="No shop orders yet"
          description="When you place a book order on the Foundation shop, it will appear here with courier tracking. Sample orders are not shown."
          cta={{ label: "Visit the shop", href: "/shop" }}
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const expanded = expandedId === order.id;
            const first = order.items[0];
            const extraItems = Math.max(0, order.items.length - 1);
            const shipment = getShipments().find((item) => item.orderId === order.id && item.note !== "Cancelled");

            return (
              <article key={order.id} className="card overflow-visible">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : order.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-warm-cream/40"
                >
                  <span className="shrink-0 overflow-hidden rounded-xl">
                    <MediaPlaceholder
                      variant="book"
                      label={first?.title ?? "Book"}
                      aspectClassName="aspect-[3/4] w-16"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-text-primary">
                      {first?.title ?? "Book"}
                      {extraItems > 0 && (
                        <span className="ml-1 font-normal text-text-muted">
                          +{extraItems} more
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-burgundy">
                      {latestStatusText(order)}
                    </span>
                    <span className="mt-1 block text-xs text-text-muted">
                      Order ID: {order.id} · {formatDate(order.date)}
                    </span>
                  </span>

                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-text-muted transition-transform duration-200 ${
                      expanded ? "rotate-90" : ""
                    }`}
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>

                {expanded && (
                  <div className="border-t border-border bg-warm-cream/40 p-5 sm:p-6">
                    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-text-primary">
                          Tracking
                          <span className="ml-2 text-xs font-normal text-text-muted">
                            Live scans synced from the courier
                          </span>
                        </h3>
                        {!isHyperlocalProvider(order.courierChoice?.provider, order.courierChoice?.lastMile) &&
                        order.trackingId &&
                        ["Shipped", "Out for Delivery", "Delivered"].includes(order.status) ? (
                          <span className="max-w-[46%] text-right text-xs font-semibold break-all text-burgundy">
                            {order.trackingId}
                          </span>
                        ) : null}
                      </div>

                      <OrderTrackingTimeline order={order} />
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                      <div className="rounded-2xl border border-border bg-white p-5">
                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                          Items
                        </h4>
                        <div className="space-y-3">
                          {order.items.map((item) => (
                            <div
                              key={item.bookId}
                              className="flex items-center gap-3 text-sm"
                            >
                              <span className="min-w-0 flex-1 truncate text-text-primary">
                                {item.title}
                              </span>
                              <span className="text-text-muted">
                                × {item.quantity}
                              </span>
                              <span className="font-medium text-text-primary">
                                {formatPrice(item.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
                          <div className="flex justify-between">
                            <dt className="text-text-muted">MRP</dt>
                            <dd className="font-medium text-text-primary">
                              {formatPrice(order.subtotal + order.discount)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-text-muted">Discount</dt>
                            <dd className="font-medium text-emerald-700">
                              − {formatPrice(order.discount)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-text-muted">Shipping</dt>
                            <dd className="font-medium text-text-primary">
                              {order.shipping === 0
                                ? "FREE"
                                : formatPrice(order.shipping)}
                            </dd>
                          </div>
                          <div className="flex justify-between border-t border-border pt-2 text-sm">
                            <dt className="font-semibold text-text-primary">
                              Order total
                            </dt>
                            <dd className="font-bold text-burgundy">
                              {formatPrice(order.total)}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-border bg-white p-5">
                          <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                            Delivery details
                          </h4>
                          {order.deliveryMode === "store_pickup" ? (
                            <p className="text-sm text-text-primary">
                              Store pickup at the Foundation office, Pune.
                              You will be notified via WhatsApp when it is ready.
                            </p>
                          ) : (
                            <dl className="space-y-2 text-sm">
                              <div className="flex justify-between gap-4">
                                <dt className="text-text-muted">Deliver to</dt>
                                <dd className="text-right font-medium text-text-primary">
                                  {order.deliveryAddress?.fullName} ·{" "}
                                  {order.deliveryAddress?.phone}
                                </dd>
                              </div>
                              <div className="flex justify-between gap-4">
                                <dt className="text-text-muted">Address</dt>
                                <dd className="text-right text-text-primary">
                                  {customerAddressLine(order.deliveryAddress)}
                                </dd>
                              </div>
                              <div className="flex justify-between gap-4">
                                <dt className="text-text-muted">Expected delivery</dt>
                                <dd className="text-right font-medium text-emerald-700">
                                  {shipment?.expectedBy || order.eta || "Within 5 business days"}
                                </dd>
                              </div>
                            </dl>
                          )}
                        </div>

                        <ReturnSection order={order} />
                      </div>
                    </div>

                    <p className="mt-5 text-center text-xs text-text-muted">
                      Need help with a damaged item?{" "}
                      <Link
                        href="/contact"
                        className="font-semibold text-burgundy hover:underline"
                      >
                        Contact support
                      </Link>{" "}
                      with your Order ID {order.id}.
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
