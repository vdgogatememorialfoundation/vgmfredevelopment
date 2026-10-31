import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { findRow, listOrders, listTickets, money, str } from "../../src/api";
import { ACCOUNT_SECTIONS, accountSection } from "../../src/account-nav";
import { useAuth } from "../../src/auth";
import { useFeed } from "../../src/feed";
import { useWishlist } from "../../src/wishlist";
import { Banner, Button, Card, Empty, Heading, Loading, Muted, PageHeader, Screen } from "../../src/ui";

export default function AccountSectionScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const item = accountSection(String(section ?? ""));
  if (!item) {
    return (
      <Screen>
        <Empty icon="person-outline" label="This account page is not available." actionLabel="Back to my account" onAction={() => router.replace("/account")} />
      </Screen>
    );
  }
  return <SectionBody id={item.id} title={item.title} subtitle={item.subtitle} />;
}

function SectionBody({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  if (id === "orders") return <OrdersSection title={title} subtitle={subtitle} />;
  if (id === "tickets") return <TicketsSection title={title} subtitle={subtitle} />;
  if (id === "wishlist") return <WishlistSection title={title} subtitle={subtitle} />;
  if (id === "profile") return <ProfileSection title={title} subtitle={subtitle} />;
  if (id === "loyalty") return <LoyaltySection title={title} subtitle={subtitle} />;
  const empty = ACCOUNT_SECTIONS.find((item) => item.id === id);
  return (
    <Screen>
      <PageHeader kicker="My Account" title={title} subtitle={subtitle} />
      <Empty
        icon={empty?.icon ?? "file-tray-outline"}
        label={emptyCopy(id)}
        actionLabel={emptyAction(id).label}
        onAction={() => router.push(emptyAction(id).href as never)}
      />
    </Screen>
  );
}

function emptyCopy(id: string) {
  switch (id) {
    case "registrations":
      return "No event registrations are linked to this account yet.";
    case "applications":
      return "No Foundation applications are on this account yet.";
    case "notifications":
      return "You have no Foundation notifications right now.";
    case "subscriptions":
      return "No newsletter subscriptions are active on this account.";
    case "payments":
      return "No payments are listed for this account yet.";
    case "receipts":
      return "No payment receipts are available yet.";
    case "cards":
      return "No cards are saved on this account.";
    case "addresses":
      return "No saved addresses yet. Enter the delivery address when you checkout.";
    default:
      return "Nothing to show here yet.";
  }
}

function emptyAction(id: string) {
  if (id === "registrations" || id === "applications") return { label: "Browse events", href: "/events" };
  if (id === "subscriptions") return { label: "Read articles", href: "/articles" };
  if (id === "cards" || id === "addresses" || id === "payments" || id === "receipts") return { label: "Browse the shop", href: "/shop" };
  return { label: "Back to my account", href: "/account" };
}

function OrdersSection({ title, subtitle }: { title: string; subtitle: string }) {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void listOrders()
      .then((next) => {
        if (!cancelled) setOrders(next);
      })
      .catch((error) => {
        if (!cancelled) setNote((error as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) return <Loading />;

  return (
    <Screen>
      <PageHeader kicker="My Account" title={title} subtitle={subtitle} />
      <Banner text={note} tone="error" />
      {orders.map((item) => (
        <Card key={str(item.id)}>
          <Heading>Order {str(item.id)}</Heading>
          <Muted>
            {[str(item.paymentStatus, "Unpaid"), str(item.status, "Recorded"), money(item.total)].filter(Boolean).join(" · ")}
          </Muted>
        </Card>
      ))}
      {!orders.length ? (
        <Empty icon="receipt-outline" label="No publication orders for this account yet." actionLabel="Browse the shop" onAction={() => router.push("/shop")} />
      ) : null}
    </Screen>
  );
}

function TicketsSection({ title, subtitle }: { title: string; subtitle: string }) {
  const { session } = useAuth();
  const [tickets, setTickets] = useState<Array<Record<string, unknown>>>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void listTickets()
      .then((next) => {
        if (!cancelled) setTickets(next);
      })
      .catch((error) => {
        if (!cancelled) setNote((error as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) return <Loading />;

  return (
    <Screen>
      <PageHeader kicker="My Account" title={title} subtitle={subtitle} />
      <Banner text={note} tone="error" />
      {tickets.map((item) => (
        <Card key={str(item.id)}>
          <Heading>{str(item.subject)}</Heading>
          <Muted>
            {str(item.status)} · {str(item.id)}
          </Muted>
        </Card>
      ))}
      {!tickets.length ? <Empty icon="help-buoy-outline" label="No support tickets on this account yet." /> : null}
      <Button icon="create-outline" label="Raise a ticket" onPress={() => router.push("/support")} />
    </Screen>
  );
}

function WishlistSection({ title, subtitle }: { title: string; subtitle: string }) {
  const { feed } = useFeed();
  const wishlist = useWishlist();
  const rows = wishlist.ids
    .map((id) => findRow(feed?.books, id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <Screen>
      <PageHeader kicker="My Account" title={title} subtitle={subtitle} />
      {rows.map((item) => (
        <Card key={str(item.id)}>
          <Heading>{str(item.title)}</Heading>
          <Muted>{[str(item.author), money(item.price)].filter(Boolean).join(" · ")}</Muted>
          <Button label="View publication" onPress={() => router.push(`/book/${str(item.id)}`)} />
          <Button kind="ghost" label="Remove" onPress={() => wishlist.toggle(str(item.id))} />
        </Card>
      ))}
      {!rows.length ? (
        <Empty icon="heart-outline" label="Your wishlist is empty. Save a publication from the shop." actionLabel="Browse the shop" onAction={() => router.push("/shop")} />
      ) : null}
    </Screen>
  );
}

function ProfileSection({ title, subtitle }: { title: string; subtitle: string }) {
  const { session } = useAuth();
  return (
    <Screen>
      <PageHeader kicker="My Account" title={title} subtitle={subtitle} />
      <Card featured>
        <Heading>{session?.name || "Member"}</Heading>
        <Muted>Email · {session?.email || "—"}</Muted>
        <Muted>Account ID · {session?.accountId || "Issued after the first verified sign-in"}</Muted>
      </Card>
    </Screen>
  );
}

function LoyaltySection({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Screen>
      <PageHeader kicker="My Account" title={title} subtitle={subtitle} />
      <Card featured>
        <Muted>Available points</Muted>
        <Heading>0</Heading>
        <Muted>Points appear here after a qualifying shop order or registration.</Muted>
      </Card>
    </Screen>
  );
}
