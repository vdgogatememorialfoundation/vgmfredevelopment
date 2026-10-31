import { useEffect, useState } from "react";
import { router } from "expo-router";
import { listOrders, listTickets, money, str } from "../../src/api";
import { useAuth } from "../../src/auth";
import { ChatFab, TopBar } from "../../src/chrome";
import { SITE } from "../../src/site-content";
import { useFeed } from "../../src/feed";
import { Banner, Button, Card, Divider, Heading, ListRow, Loading, Muted, PageHeader, Screen, SiteFooter } from "../../src/ui";
import { View } from "react-native";

export default function AccountScreen() {
  const { feed, loading, refresh } = useFeed();
  const { session, signOut } = useAuth();
  const [note, setNote] = useState("");
  const [tone, setTone] = useState<"note" | "error" | "success">("note");
  const [tickets, setTickets] = useState<Array<Record<string, unknown>>>([]);
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void (async () => {
      try {
        const [nextTickets, nextOrders] = await Promise.all([listTickets(), listOrders()]);
        if (cancelled) return;
        setTickets(nextTickets);
        setOrders(nextOrders);
      } catch (err) {
        if (!cancelled) {
          setTone("error");
          setNote((err as Error).message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading && !feed) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
    <Screen refreshing={loading} onRefresh={refresh}>
      <TopBar bag />
      <PageHeader
        kicker="Account"
        title={session?.name || "Your account"}
        subtitle="The same Foundation account used on the website — email, phone and 12-digit Account ID."
      />
      <Banner text={note} tone={tone} />
      <Card featured>
        <Heading>{session?.name || "Member"}</Heading>
        <Muted>{session?.email}</Muted>
        {session?.accountId ? <Heading>Account ID {session.accountId}</Heading> : <Muted>Your 12-digit Account ID appears after the first verified sign-in.</Muted>}
        <Button
          kind="ghost"
          icon="log-out-outline"
          label="Sign out"
          onPress={async () => {
            await signOut();
            setTickets([]);
            setOrders([]);
          }}
        />
      </Card>
      <Divider />
      <Heading>Orders</Heading>
      {orders.map((item) => (
        <Card key={str(item.id)}>
          <Heading>Order {str(item.id)}</Heading>
          <Muted>
            {str(item.paymentStatus, "unpaid")} · {str(item.status, "Recorded")} · {str(item.method, "Razorpay")} · {money(item.total)}
          </Muted>
        </Card>
      ))}
      {!orders.length ? <Muted>No publication orders for this email yet. Checkout stays in the app with Razorpay.</Muted> : null}
      <Heading>Support tickets</Heading>
      {tickets.map((item) => (
        <Card key={str(item.id)}>
          <Heading>{str(item.subject)}</Heading>
          <Muted>
            {str(item.status)} · {str(item.id)}
          </Muted>
        </Card>
      ))}
      {!tickets.length ? <Muted>No tickets for this email yet.</Muted> : null}
      <ListRow icon="chatbubbles-outline" title="Chat" subtitle="Ask the Foundation desk" onPress={() => router.push("/chat")} />
      <ListRow icon="help-buoy-outline" title="Support" subtitle="Open or follow a ticket" onPress={() => router.push("/support")} />
      <ListRow icon="ribbon-outline" title="Certificates" subtitle="Verify a Foundation certificate" onPress={() => router.push("/certificates")} />
      <ListRow icon="help-circle-outline" title="FAQ" subtitle="Answers from the published site" onPress={() => router.push("/faq")} />
      <ListRow icon="mail-outline" title="Contact" subtitle={SITE.email} onPress={() => router.push("/contact")} />
      <ListRow icon="people-outline" title="About the Foundation" subtitle="Legacy, awards, history, trustees" onPress={() => router.push("/about")} />
      <ListRow icon="shield-checkmark-outline" title="Privacy" onPress={() => router.push("/policy/privacy")} />
      <ListRow icon="document-text-outline" title="Terms" onPress={() => router.push("/policy/terms")} />
      <SiteFooter />
    </Screen>
    <ChatFab />
    </View>
  );
}
