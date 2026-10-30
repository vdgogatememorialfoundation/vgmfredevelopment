import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { findRow, money, placeOrder, str } from "../src/api";
import { useAuth } from "../src/auth";
import { useCart } from "../src/cart";
import { useFeed } from "../src/feed";
import { Banner, Button, Card, Empty, Field, Muted, Screen, Title } from "../src/ui";

export default function CartScreen() {
  const cart = useCart();
  const { session } = useAuth();
  const { feed } = useFeed();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
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
      <Title>Bag</Title>
      <Muted>
        This bag records an unpaid publication request on the mobile API. It is not the website checkout, and it cannot be
        marked paid from the phone. Card payment stays on the website.
      </Muted>
      <Banner text={note} />
      {priced.map((item) => (
        <Card key={item.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700" }}>{item.title}</Text>
              <Muted>
                {item.quantity} × {money(item.price)}
                {item.inCatalogue ? "" : " · not in the published catalogue"}
                {item.outOfStock ? " · out of stock" : ""}
              </Muted>
            </View>
            <Button kind="ghost" label="Remove" onPress={() => cart.remove(item.id)} />
          </View>
        </Card>
      ))}
      {!priced.length ? <Empty label="Your bag is empty." /> : <Muted>Total {money(total)}</Muted>}
      {priced.length ? (
        session ? (
          <>
            <Muted>Request will be stored for {session.email}.</Muted>
            <Field label="Name" value={requestName} onChange={setName} />
            <Field label="Phone (optional)" value={phone} onChange={setPhone} keyboard="phone-pad" />
            <Button
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
                  setNote(
                    `Request ${str(order.id)} recorded as unpaid (${money(order.total)}). This is not a website order and is not paid.`
                  );
                } catch (err) {
                  setNote((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        ) : (
          <>
            <Muted>Sign in with your email code on Account to record an unpaid publication request.</Muted>
            <Button label="Go to Account" onPress={() => router.push("/account")} />
          </>
        )
      ) : null}
    </Screen>
  );
}
