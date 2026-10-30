import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { getSession, listOrders, listTickets, money, saveSession, sendEmailOtp, str, verifyEmailOtp, type Session } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Banner, Button, Card, Field, Loading, Muted, Screen, Title } from "../../src/ui";

export default function AccountScreen() {
  const { feed, loading, refresh } = useFeed();
  const [session, setSession] = useState<Session | null>(getSession());
  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [note, setNote] = useState("");
  const [tickets, setTickets] = useState<Array<Record<string, unknown>>>([]);
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);

  if (loading && !feed) return <Loading />;

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Title>{session ? "Signed in" : "Email sign-in"}</Title>
      <Banner text={note} />
      {session ? (
        <>
          <Text style={{ fontSize: 16 }}>{session.name || session.email}</Text>
          <Muted>{session.email}</Muted>
          <Button
            kind="ghost"
            label="Sign out"
            onPress={async () => {
              await saveSession(null);
              setSession(null);
              setOtpSent(false);
              setTickets([]);
              setOrders([]);
              setNote("Signed out.");
            }}
          />
          <Button
            label="Refresh tickets & orders"
            onPress={async () => {
              try {
                setTickets(await listTickets());
                setOrders(await listOrders());
                setNote("");
              } catch (err) {
                setNote((err as Error).message);
              }
            }}
          />
          {tickets.map((item) => (
            <Card key={str(item.id)}>
              <Text style={{ fontWeight: "700" }}>{str(item.subject)}</Text>
              <Muted>
                {str(item.id)} · {str(item.status)}
              </Muted>
            </Card>
          ))}
          {orders.map((item) => (
            <Card key={str(item.id)}>
              <Text style={{ fontWeight: "700" }}>Order {str(item.id)}</Text>
              <Muted>
                {str(item.status)} · {money(item.total)}
              </Muted>
            </Card>
          ))}
          <Button kind="ghost" label="Support ticket" onPress={() => router.push("/support")} />
          <Button kind="ghost" label="FAQ" onPress={() => router.push("/faq")} />
          <Button kind="ghost" label="Contact" onPress={() => router.push("/contact")} />
          <Button kind="ghost" label="Privacy policy" onPress={() => router.push("/policy/privacy")} />
          <Button kind="ghost" label="Terms" onPress={() => router.push("/policy/terms")} />
        </>
      ) : (
        <>
          <Muted>A 6-digit code is sent to your email. Website password login stays on the site because those accounts are stored in the browser CMS.</Muted>
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" />
          {otpSent ? <Field label="Email code" value={otp} onChange={setOtp} keyboard="numeric" /> : null}
          <Button
            label={otpSent ? "Verify email code" : "Send email code"}
            onPress={async () => {
              try {
                if (!otpSent) {
                  await sendEmailOtp(email, name);
                  setOtpSent(true);
                  setNote("Check your email for the 6-digit code.");
                  return;
                }
                const next = await verifyEmailOtp(email, otp, name);
                setSession(next);
                setNote("Signed in.");
              } catch (err) {
                setNote((err as Error).message);
              }
            }}
          />
        </>
      )}
    </Screen>
  );
}
