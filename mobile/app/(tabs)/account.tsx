import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { listOrders, listTickets, mediaUrl, money, sendEmailOtp, str, verifyEmailOtp } from "../../src/api";
import { useAuth } from "../../src/auth";
import { useBrand, useFeed } from "../../src/feed";
import { Banner, BrandMark, Button, Card, Divider, Field, Heading, ListRow, Loading, Muted, PageHeader, Screen } from "../../src/ui";

export default function AccountScreen() {
  const { feed, loading, refresh } = useFeed();
  const brand = useBrand();
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
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        <BrandMark uri={mediaUrl(brand.logoUrl) || undefined} name={brand.name} size={64} />
      </View>
      <PageHeader
        kicker="Account"
        title={session ? session.name || "Your account" : "Welcome"}
        subtitle={session ? session.email : "Sign in with a 6-digit code sent to your email."}
      />
      <Banner text={note} tone={tone} />
      {session ? (
        <>
          <Button
            kind="ghost"
            icon="log-out-outline"
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
          <Divider />
          <Heading>Orders</Heading>
          {orders.map((item) => (
            <Card key={str(item.id)}>
              <Heading>Request {str(item.id)}</Heading>
              <Muted>
                {str(item.paymentStatus, "unpaid")} · {str(item.status, "Recorded")} · {money(item.total)}
              </Muted>
            </Card>
          ))}
          {!orders.length ? <Muted>No publication requests for this email yet.</Muted> : null}
          <View style={{ height: 12 }} />
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
          <View style={{ height: 16 }} />
          <ListRow icon="chatbubbles-outline" title="Support" subtitle="Open or follow a ticket" onPress={() => router.push("/support")} />
          <ListRow icon="ribbon-outline" title="Certificates" subtitle="Verify a Foundation certificate" onPress={() => router.push("/certificates")} />
          <ListRow icon="help-circle-outline" title="FAQ" subtitle="Answers from the published site" onPress={() => router.push("/faq")} />
          <ListRow icon="mail-outline" title="Contact" subtitle="Write to the Foundation" onPress={() => router.push("/contact")} />
          <ListRow icon="shield-checkmark-outline" title="Privacy" onPress={() => router.push("/policy/privacy")} />
          <ListRow icon="document-text-outline" title="Terms" onPress={() => router.push("/policy/terms")} />
        </>
      ) : (
        <Card>
          <Field label="Name" value={name} onChange={setName} autoCapitalize="words" />
          <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" />
          {otpSent ? <Field label="6-digit code" value={otp} onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))} keyboard="numeric" /> : null}
          <Button
            icon={otpSent ? "checkmark-outline" : "mail-outline"}
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
        </Card>
      )}
    </Screen>
  );
}
