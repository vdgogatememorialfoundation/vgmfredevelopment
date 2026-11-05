"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SectionHeader from "@/components/account/SectionHeader";
import EmptyState from "@/components/account/EmptyState";
import MediaPlaceholder from "@/components/common/MediaPlaceholder";
import OrderTrackingPreview from "@/components/store/OrderTrackingPreview";
import { useAuth } from "@/components/auth/AuthContext";
import { useCommerceMirror } from "@/lib/commerce-sync";
import { getOrdersForAccount, purgeSampleOrders } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export default function OrdersPage() {
  const { user } = useAuth();
  const { ready, version } = useCommerceMirror();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    purgeSampleOrders();
    const id = window.location.hash.replace(/^#/, "");
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
      if (id) router.replace(`/account/orders/${encodeURIComponent(id)}`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [router]);

  const orders = mounted && ready ? getOrdersForAccount(user) : [];
  void version;

  return (
    <div>
      <SectionHeader
        title="My Orders"
        description="Tap an order to open its page with live tracking, delivery details and, if an item arrived damaged, a replacement request."
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
            const first = order.items[0];
            const extraItems = Math.max(0, order.items.length - 1);

            return (
              <article id={order.id} key={order.id} className="card overflow-visible">
                <Link
                  href={`/account/orders/${encodeURIComponent(order.id)}`}
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
                    <OrderTrackingPreview order={order} />
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
                    className="shrink-0 text-text-muted"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>

              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
