import { useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { findRow, money, placeOrder, str } from "../src/api";
import { useAuth } from "../src/auth";
import { useCart } from "../src/cart";
import { useFeed } from "../src/feed";
import { Banner, Button, Card, Empty, Field, Heading, Muted, PageHeader, QtyStepper, Screen } from "../src/ui";
import { useTheme } from "../src/theme";

export default function CartScreen() {
  const cart = useCart();
  const theme = useTheme();
  const { session } = useAuth();
  const { feed } = useFeed();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [tone, setTone] = useState<"note" | "error" | "success">("note");
  const [busy, setBusy] = useState(false);
  const requestName = name || session?.name || "";

  const priced = useMemo(
    () =>
      cart.items.map((item) => {
        const book = findRow(feed?.books, item.id);
        return {
          ...item,
          title: str(book?.title, item.title),
          price: Number(book?.price ?? 0) || 0,
          inCatalogue: Boolean(book) && book?.active !== false,
          outOfStock: str(book?.stockStatus) === "out_of_stock",
        };
      }),
    [cart.items, feed?.books]
  );
  const missing = priced.filter((item) => !item.inCatalogue || item.outOfStock);
  const total = priced.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <Screen>
      <PageHeader kicker="Shop" title={theme.labels.bag} subtitle="Card payment stays on the website. This bag records an unpaid publication request after you sign in." />
      <Banner text={note} tone={tone} />
      {priced.map((item) => (
        <Card key={item.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Heading>{item.title}</Heading>
              <Muted>
                {money(item.price)}
                {item.inCatalogue ? "" : " · not in the published catalogue"}
                {item.outOfStock ? " · out of stock" : ""}
              </Muted>
            </View>
            <QtyStepper value={item.quantity} onChange={(value) => cart.setQuantity(item.id, value)} />
          </View>
        </Card>
      ))}
      {!priced.length ? <Empty icon="bag-handle-outline" label="Your bag is empty." actionLabel="Browse publications" onAction={() => router.push("/shop")} /> : null}
      {priced.length ? (
        <Card featured>
          <Heading>Summary</Heading>
          <Muted>
            {priced.reduce((sum, item) => sum + item.quantity, 0)} items · {money(total)}
          </Muted>
          {session ? (
            <>
              <Muted>Request will be stored for {session.email} as unpaid.</Muted>
              <Field label="Name" value={requestName} onChange={setName} autoCapitalize="words" />
              <Field label="Phone (optional)" value={phone} onChange={setPhone} keyboard="phone-pad" />
              <Button
                icon="create-outline"
                label={busy ? "Recording request…" : "Record unpaid request"}
                disabled={busy || missing.length > 0}
                onPress={async () => {
                  setBusy(true);
                  try {
                    const order = await placeOrder({
                      name: requestName,
                      phone,
                      items: priced.map((item) => ({ id: item.id, quantity: item.quantity })),
                    });
                    cart.clear();
                    setTone("success");
                    setNote(`Request ${str(order.id)} recorded as unpaid (${money(order.total)}). Pay on the website if needed.`);
                  } catch (err) {
                    setTone("error");
                    setNote((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          ) : (
            <>
              <Muted>Sign in on Account to record an unpaid publication request.</Muted>
              <Button icon="person-outline" label="Go to Account" onPress={() => router.push("/account")} />
            </>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}
