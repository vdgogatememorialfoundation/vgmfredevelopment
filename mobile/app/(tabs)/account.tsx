import { useEffect, useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { listOrders, listTickets, money, sendEmailOtp, str, verifyEmailOtp } from "../../src/api";
import { useAuth } from "../../src/auth";
import { useFeed } from "../../src/feed";
import { Banner, Button, Card, Field, Loading, Muted, Screen, Title } from "../../src/ui";

export default function AccountScreen() {
  const { feed, loading, refresh } = useFeed();
  const { session, setSession, signOut } = useAuth();
  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
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
        if (!cancelled) setNote((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading && !feed) return <Loading />;

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Title>{session ? "Signed in" : "Email sign-in"}</Title>
      <Muted>Mobile email-code accounts, tickets and orders are stored on the mobile API. Website password login, website orders and website tickets stay in that browser and are not shown here.</Muted>
      <Banner text={note} />
      {session ? (
        <>
          <Text style={{ fontSize: 16 }}>{session.name || session.email}</Text>
          <Muted>{session.email}</Muted>
          <Button
            kind="ghost"
            label="Sign out"
            onPress={async () => {
              await signOut();
              setOtpSent(false);
              setTickets([]);
              setOrders([]);
              setNote("Signed out.");
            }}
          />
          <Title>Mobile tickets</Title>
          {(session ? tickets : []).map((item) => (
            <Card key={str(item.id)}>
              <Text style={{ fontWeight: "700" }}>{str(item.subject)}</Text>
              <Muted>
                {str(item.id)} · {str(item.status)}
              </Muted>
            </Card>
          ))}
          {!tickets.length ? <Muted>No mobile-API tickets for this email yet.</Muted> : null}
          <Title>Mobile publication requests</Title>
          {orders.map((item) => (
            <Card key={str(item.id)}>
              <Text style={{ fontWeight: "700" }}>Request {str(item.id)}</Text>
              <Muted>
                {str(item.paymentStatus, "unpaid")} · {str(item.status, "Recorded")} · {money(item.total)}
              </Muted>
            </Card>
          ))}
          {!orders.length ? <Muted>No unpaid publication requests for this email yet.</Muted> : null}
          <Button kind="ghost" label="Support ticket" onPress={() => router.push("/support")} />
          <Button kind="ghost" label="FAQ" onPress={() => router.push("/faq")} />
          <Button kind="ghost" label="Contact" onPress={() => router.push("/contact")} />
          <Button kind="ghost" label="Privacy policy" onPress={() => router.push("/policy/privacy")} />
          <Button kind="ghost" label="Terms" onPress={() => router.push("/policy/terms")} />
        </>
      ) : (
        <>
          <Muted>A 6-digit code is sent to your email. Website password and SMS login stay on the site because those accounts are stored in the browser CMS.</Muted>
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" />
          {otpSent ? <Field label="Email code" value={otp} onChange={setOtp} keyboard="numeric" /> : null}
          <Button
            label={busy ? "Please wait…" : otpSent ? "Verify email code" : "Send email code"}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                if (!otpSent) {
                  await sendEmailOtp(email, name);
                  setOtpSent(true);
                  setNote("Check your email for the 6-digit code.");
                  return;
                }
                const next = await verifyEmailOtp(email, otp, name);
                await setSession(next);
                setNote("Signed in.");
              } catch (err) {
                setNote((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </Screen>
  );
}
