import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { listOrders, listTickets, mediaUrl, money, sendEmailOtp, str, verifyEmailOtp } from "../../src/api";
import { useAuth } from "../../src/auth";
import { useBrand, useFeed } from "../../src/feed";
import { Banner, BrandMark, Button, Card, Field, Heading, Loading, Muted, Screen, Title } from "../../src/ui";
import { useTheme } from "../../src/theme";

export default function AccountScreen() {
  const { feed, loading, refresh } = useFeed();
  const brand = useBrand();
  const theme = useTheme();
  const { session, setSession, signOut } = useAuth();
  const [name, setName] = useState(session?.name ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [tone, setTone] = useState<"note" | "error" | "success">("note");
  const [wait, setWait] = useState(0);
  const [tickets, setTickets] = useState<Array<Record<string, unknown>>>([]);
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!wait) return;
    const timer = setInterval(() => setWait((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [wait]);

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
    <Screen refreshing={loading} onRefresh={refresh}>
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <BrandMark uri={mediaUrl(brand.logoUrl) || undefined} name={brand.name} />
        <Title>{session ? "Your account" : "Welcome"}</Title>
        <Muted>{session ? session.email : "Sign in with a 6-digit code sent to your email."}</Muted>
      </View>
      <Banner text={note} tone={tone} />
      {session ? (
        <>
          <Heading>{session.name || session.email}</Heading>
          <Button
            kind="ghost"
            label="Sign out"
            onPress={async () => {
              await signOut();
              setOtpSent(false);
              setOtp("");
              setTickets([]);
              setOrders([]);
              setTone("note");
              setNote("Signed out.");
            }}
          />
          <Heading>Orders</Heading>
          {orders.map((item) => (
            <Card key={str(item.id)}>
              <Text style={{ fontWeight: "700", color: theme.colors.text }}>Request {str(item.id)}</Text>
              <Muted>
                {str(item.paymentStatus, "unpaid")} · {str(item.status, "Recorded")} · {money(item.total)}
              </Muted>
            </Card>
          ))}
          {!orders.length ? <Muted>No publication requests for this email yet.</Muted> : null}
          <Heading>Support tickets</Heading>
          {tickets.map((item) => (
            <Card key={str(item.id)}>
              <Text style={{ fontWeight: "700", color: theme.colors.text }}>{str(item.subject)}</Text>
              <Muted>
                {str(item.status)} · {str(item.id)}
              </Muted>
            </Card>
          ))}
          {!tickets.length ? <Muted>No tickets for this email yet.</Muted> : null}
          <Button kind="ghost" label="Support" onPress={() => router.push("/support")} />
          <Button kind="ghost" label="Certificates" onPress={() => router.push("/certificates")} />
          <Button kind="ghost" label="FAQ" onPress={() => router.push("/faq")} />
          <Button kind="ghost" label="Contact" onPress={() => router.push("/contact")} />
          <Button kind="ghost" label="Privacy" onPress={() => router.push("/policy/privacy")} />
          <Button kind="ghost" label="Terms" onPress={() => router.push("/policy/terms")} />
        </>
      ) : (
        <>
          <Field label="Name" value={name} onChange={setName} autoCapitalize="words" />
          <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" />
          {otpSent ? (
            <Field label="6-digit code" value={otp} onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))} keyboard="numeric" />
          ) : null}
          <Button
            label={busy ? "Please wait…" : otpSent ? "Verify code" : "Send code"}
            disabled={busy || (otpSent && otp.length !== 6)}
            onPress={async () => {
              setBusy(true);
              try {
                if (!otpSent) {
                  await sendEmailOtp(email, name);
                  setOtpSent(true);
                  setWait(60);
                  setTone("success");
                  setNote("Check your email for the 6-digit code.");
                  return;
                }
                const next = await verifyEmailOtp(email, otp, name);
                await setSession(next);
                setTone("success");
                setNote("Signed in.");
              } catch (err) {
                setTone("error");
                setNote((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
          {otpSent ? (
            <Pressable
              disabled={wait > 0 || busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await sendEmailOtp(email, name);
                  setWait(60);
                  setTone("success");
                  setNote("A new code was sent.");
                } catch (err) {
                  setTone("error");
                  setNote((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Muted>{wait > 0 ? `Resend code in ${wait}s` : "Resend code"}</Muted>
            </Pressable>
          ) : null}
        </>
      )}
    </Screen>
  );
}
