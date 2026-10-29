"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { inboxFor, markInboxRead, subscribeInbox, unreadInboxCount } from "@/lib/inbox";

function snapshot() {
  return window.localStorage.getItem("vgmf_inbox") ?? "";
}

export function InboxBell({ href, tone = "light" }: { href: string; tone?: "light" | "dark" }) {
  const { user } = useAuth();
  useSyncExternalStore(subscribeInbox, snapshot, () => "");
  const unread = unreadInboxCount(user);
  return (
    <Link
      href={href}
      className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border ${
        tone === "dark" ? "border-white/20 text-white" : "border-border text-ink"
      }`}
      aria-label={unread ? `${unread} unread notifications` : "Notifications"}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.7 1.7 0 0 0 3.4 0" />
      </svg>
      {unread > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-burgundy px-1 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

export function InboxList({ emptyHref, emptyLabel }: { emptyHref?: string; emptyLabel?: string }) {
  const { user } = useAuth();
  useSyncExternalStore(subscribeInbox, snapshot, () => "");
  const items = useMemo(() => inboxFor(user), [user]);

  if (!items.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-sm text-text-muted">
        No notifications yet.
        {emptyHref ? (
          <>
            {" "}
            <Link href={emptyHref} className="font-semibold text-burgundy">
              {emptyLabel || "Open dashboard"}
            </Link>
          </>
        ) : null}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.slice(0, 40).map((item) => {
        const unread = user?.email ? !(item.readBy ?? []).includes(user.email.toLowerCase()) : false;
        const inner = (
          <>
            <p className={`text-sm ${unread ? "font-semibold text-ink" : "text-ink"}`}>{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-text-muted">{item.body}</p>
            <p className="mt-2 text-[11px] uppercase tracking-wider text-text-muted">
              {item.kind} · {new Date(item.createdAt).toLocaleString("en-IN")}
            </p>
          </>
        );
        const onOpen = () => {
          if (user?.email) markInboxRead(item.id, user.email);
        };
        return (
          <li key={item.id} className={`rounded-xl border bg-white p-4 ${unread ? "border-burgundy/40" : "border-border"}`}>
            {item.href ? (
              <Link href={item.href} className="block" onClick={onOpen}>
                {inner}
              </Link>
            ) : (
              <button type="button" className="block w-full text-left" onClick={onOpen}>
                {inner}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
