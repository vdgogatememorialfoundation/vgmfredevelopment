"use client";

import { useSyncExternalStore } from "react";
import SectionHeader from "@/components/account/SectionHeader";
import { InboxList } from "@/components/notifications/InboxBell";
import { useAuth } from "@/components/auth/AuthContext";
import { markAllInboxRead, subscribeInbox } from "@/lib/inbox";

function snapshot() {
  return window.localStorage.getItem("vgmf_inbox") ?? "";
}

export default function AccountNotificationsPage() {
  const { user } = useAuth();
  useSyncExternalStore(subscribeInbox, snapshot, () => "");

  return (
    <div>
      <SectionHeader
        title="Notifications"
        description="Order updates, restocks, ticket replies and other alerts for your account."
      />
      <button
        type="button"
        className="btn-outline mb-5"
        onClick={() => markAllInboxRead(user)}
      >
        Mark all as read
      </button>
      <InboxList emptyHref="/account/tickets" emptyLabel="Raise a support ticket" />
    </div>
  );
}
