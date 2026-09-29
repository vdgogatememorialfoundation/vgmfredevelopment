"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SectionHeader from "@/components/account/SectionHeader";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import OrderTrackingTimeline from "@/components/store/OrderTrackingTimeline";
import ReturnSection from "@/components/store/ReturnSection";
import { useAuth } from "@/components/auth/AuthContext";
import { getOrdersByEmail, formatPrice } from "@/lib/store";
import { storeConfig } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Order } from "@/types";

function latestStatusText(order: Order) {
  switch (order.status) {
    case "Delivered":
      return "Your order is delivered";
    case "Out for Delivery":
      return "Out for delivery";
    case "Shipped":
      return "Your order has been shipped";
    case "Packed":
      return "Your order is packed";
    case "Processing":
      return "Your order is being processed";
    case "Cancelled":
      return "This order was cancelled";
    default:
      return "Your order is placed";
  }
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const orders = mounted ? getOrdersByEmail(user?.email) : [];
  const list = orders.length > 0 ? orders : demoOrders;

  return (
    <div>
      <SectionHeader
        title="My Orders"
        description="Tap an order card to view its live tracking timeline, delivery details and return instructions."
      />

      {orders.length === 0 && (
        <p className="mb-5 rounded-xl bg-warm-cream p-3 text-xs text-text-muted">
          Showing sample orders for preview. Once you place an order, it will
          appear here with live courier tracking updates.
        </p>
      )}

      <div className="space-y-4">
        {list.map((order) => {
          const expanded = expandedId === order.id;
          const first = order.items[0];
          const extraItems = Math.max(0, order.items.length - 1);

          return (
            <article key={order.id} className="card overflow-hidden">
              {/* Clickable order card */}
              <button
                type="button"
                onClick={() =>
                  setExpandedId(expanded ? null : order.id)
                }
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

              {/* Expanded tracking */}
              {expanded && (
                <div className="border-t border-border bg-warm-cream/40 p-5 sm:p-6">
                  {/* Tracking timeline */}
                  <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-text-primary">
                        Tracking
                        <span className="ml-2 text-xs font-normal text-text-muted">
                          Live scans synced from the courier
                        </span>
                      </h3>
                      <span className="text-xs font-semibold text-burgundy">
                        {order.trackingId ?? "Tracking id pending"}
                      </span>
                    </div>

                    <OrderTrackingTimeline order={order} />
                  </div>

                  {/* All order details */}
                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    {/* Items */}
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
                          <dt className="text-text-muted">GST</dt>
                          <dd className="font-medium text-text-primary">
                            {formatPrice(order.gst)}
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

                    {/* Delivery details */}
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
                                {order.deliveryAddress?.line1}
                                {order.deliveryAddress?.landmark
                                  ? `, ${order.deliveryAddress.landmark}`
                                  : ""}
                                , {order.deliveryAddress?.city}{" "}
                                {order.deliveryAddress?.state}{" "}
                                {order.deliveryAddress?.pincode}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-4">
                              <dt className="text-text-muted">Expected delivery</dt>
                              <dd className="text-right font-medium text-emerald-700">
                                {order.eta ?? "Within 5 business days"}
                              </dd>
                            </div>
                          </dl>
                        )}

                        {order.openBoxDelivery && (
                        <div className="mt-4 rounded-xl bg-warm-cream/60 p-3 text-xs text-text-muted">
                          <p className="font-semibold text-text-primary">
                            Open-box delivery instruction
                          </p>
                          <p className="mt-1">
                            Open the package in front of the delivery agent, verify the item condition and sign the e-POD before accepting.
                          </p>
                        </div>
                        )}
                      </div>

                      <ReturnSection order={order} />
                    </div>
                  </div>

                  <p className="mt-5 text-center text-xs text-text-muted">
                    Need a SAME-BOOK replacement or a refund?{" "}
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
    </div>
  );
}

const demoOrders: Order[] = [
  {
    id: "730426189057",
    userId: "demo",
    date: "2026-09-10T09:30:00.000Z",
    items: [
      {
        bookId: "clinical-guidelines",
        title: "Ayurveda Clinical Practice Guidelines",
        quantity: 1,
        price: 850,
        originalPrice: 999,
        currency: "INR",
      },
    ],
    subtotal: 850,
    discount: 149,
    gst: 43,
    shipping: 49,
    total: 942,
    currency: "INR",
    paymentStatus: "Paid",
    status: "Shipped",
    deliveryMode: "delivery",
    deliveryAddress: {
      fullName: "Dr. Anil Deshmukh",
      phone: "+91 98220 12345",
      email: "demo@example.com",
      line1: "12 Shivaji Nagar, FC Road",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411005",
    },
    eta: "Sep 15, 2026",
    trackingId: "EK120690123457",
    courierName: "Ekart Logistics",
    openBoxDelivery: true,
    returnableDays: storeConfig.returnDays,
  },
  {
    id: "912547638420",
    userId: "demo",
    date: "2026-08-28T14:10:00.000Z",
    items: [
      {
        bookId: "rasa-shastra",
        title: "Rasa Shastra Essentials",
        quantity: 2,
        price: 760,
        originalPrice: 899,
        currency: "INR",
      },
    ],
    subtotal: 1520,
    discount: 278,
    gst: 76,
    shipping: 0,
    total: 1596,
    currency: "INR",
    paymentStatus: "Paid",
    status: "Delivered",
    deliveryMode: "delivery",
    deliveryAddress: {
      fullName: "Dr. Anil Deshmukh",
      phone: "+91 98220 12345",
      email: "demo@example.com",
      line1: "12 Shivaji Nagar, FC Road",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411005",
    },
    eta: "Sep 05, 2026",
    trackingId: "EK120346712255",
    courierName: "Ekart Logistics",
    openBoxDelivery: false,
    returnableDays: storeConfig.returnDays,
  },
];