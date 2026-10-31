import { useMemo } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { findRow, money, str } from "../src/api";
import { useCart } from "../src/cart";
import { useFeed } from "../src/feed";
import { STORE } from "../src/site-content";
import { Button, Card, Empty, Heading, Muted, PageHeader, QtyStepper, Screen } from "../src/ui";

export default function CartScreen() {
  const cart = useCart();
  const { feed } = useFeed();
  const priced = useMemo(
    () =>
      cart.items.map((item) => {
        const book = findRow(feed?.books, item.id);
        return {
          ...item,
          title: str(book?.title, item.title),
          price: Number(book?.price ?? item.price) || 0,
          inCatalogue: Boolean(book) && book?.active !== false,
          outOfStock: str(book?.stockStatus) === "out_of_stock",
        };
      }),
    [cart.items, feed?.books]
  );
  const subtotal = priced.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal >= STORE.freeShippingThreshold ? 0 : STORE.shippingFee;
  const total = subtotal + shipping;
  const blocked = priced.some((item) => !item.inCatalogue || item.outOfStock);

  return (
    <Screen>
      <PageHeader kicker="Shop" title="Cart" subtitle="Review your titles, then continue to checkout." />
      {priced.map((item) => (
        <Card key={item.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Heading>{item.title}</Heading>
              <Muted>
                {money(item.price)}
                {item.inCatalogue ? "" : " · no longer in the shop"}
                {item.outOfStock ? " · out of stock" : ""}
              </Muted>
            </View>
            <QtyStepper value={item.quantity} onChange={(value) => cart.setQuantity(item.id, value)} />
          </View>
        </Card>
      ))}
      {!priced.length ? <Empty icon="bag-handle-outline" label="Your cart is empty." actionLabel="Browse the shop" onAction={() => router.push("/shop")} /> : null}
      {priced.length ? (
        <Card featured>
          <Heading>Summary</Heading>
          <Muted>Publications {money(subtotal)}</Muted>
          <Muted>Shipping {shipping ? money(shipping) : "Free"}</Muted>
          <Heading>Total {money(total)}</Heading>
          <Button
            icon="card-outline"
            label="Checkout"
            disabled={blocked}
            onPress={() => router.push("/checkout")}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
