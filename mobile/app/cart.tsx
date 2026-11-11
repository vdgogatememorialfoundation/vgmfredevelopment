import { useMemo } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { findRow, mediaUrl, money, orderable, preorderable, preorderDeliveryDate, str, offerPrice } from "../src/api";
import { useCart } from "../src/cart";
import { useFeed } from "../src/feed";
import { STORE } from "../src/site-content";
import { useTheme } from "../src/theme";
import { Button, CoverArt, Empty, Muted, PageHeader, Panel, QtyStepper, Screen, StickyBar, Tag } from "../src/ui";

export default function CartScreen() {
  const cart = useCart();
  const theme = useTheme();
  const { feed } = useFeed();
  const priced = useMemo(
    () =>
      cart.items.map((item) => {
        const book = findRow(feed?.books, item.id);
        return {
          ...item,
          book,
          title: str(book?.title, item.title),
          price: book ? offerPrice(book) : Number(item.price) || 0,
          original: Number(book?.originalPrice) || 0,
          inCatalogue: Boolean(book) && book?.active !== false,
          preorder: preorderable(book),
          canBuy: orderable(book),
        };
      }),
    [cart.items, feed?.books]
  );
  const subtotal = priced.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const mrp = priced.reduce((sum, item) => sum + Math.max(item.original, item.price) * item.quantity, 0);
  const preorder = priced.some((item) => item.preorder);
  const shipping = preorder ? 0 : subtotal >= STORE.freeShippingThreshold ? 0 : STORE.shippingFee;
  const total = subtotal + shipping;
  const blocked = priced.some((item) => !item.inCatalogue || !item.canBuy);

  const line = (label: string, value: string, strong?: boolean) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 }}>
      <Text style={{ color: strong ? theme.colors.text : theme.colors.muted, fontWeight: strong ? "800" : "500", fontSize: strong ? 16 : 14 }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontWeight: strong ? "800" : "600", fontSize: strong ? 16 : 14 }}>{value}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Screen>
        <PageHeader kicker="Shop" title="Your bag" subtitle={priced.length ? `${cart.count} item${cart.count === 1 ? "" : "s"}` : undefined} />
        {priced.map((item) => (
          <View key={item.id} style={{ flexDirection: "row", gap: 12, backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 18, padding: 12, marginBottom: 12 }}>
            <View style={{ width: 76 }}>
              <CoverArt uri={mediaUrl(item.book?.coverImage) || undefined} title={item.title} ratio={0.75} radius={10} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text numberOfLines={2} style={{ color: theme.colors.text, fontWeight: "800", fontSize: 15, fontFamily: theme.fontFamily }}>{item.title}</Text>
              <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>
                {money(item.price)}
                {item.original > item.price ? <Text style={{ color: theme.colors.muted, fontWeight: "500", textDecorationLine: "line-through", fontSize: 12 }}>  {money(item.original)}</Text> : null}
              </Text>
              {item.preorder ? (
                <>
                  <Tag label="Pre-order" tone="gold" />
                  <Text style={{ color: "#1F6B3A", fontSize: 12, fontWeight: "800" }}>Tentative delivery by {preorderDeliveryDate(item.book)}</Text>
                </>
              ) : !item.inCatalogue ? (
                <Tag label="No longer in the shop" tone="red" />
              ) : !item.canBuy ? (
                <Tag label="Out of stock" tone="red" />
              ) : null}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <QtyStepper value={item.quantity} onChange={(value) => cart.setQuantity(item.id, value)} />
                <Text onPress={() => cart.remove(item.id)} style={{ color: theme.colors.primary, fontWeight: "700", fontSize: 12, marginTop: 8 }}>
                  Remove
                </Text>
              </View>
            </View>
          </View>
        ))}
        {!priced.length ? <Empty icon="bag-handle-outline" label="Your bag is empty." actionLabel="Browse the shop" onAction={() => router.push("/shop")} /> : null}
        {priced.length ? (
          <Panel title="Price details">
            {mrp > subtotal ? line("MRP", money(mrp)) : null}
            {mrp > subtotal ? line("Discount", `− ${money(mrp - subtotal)}`) : null}
            {line("Subtotal", money(subtotal))}
            {preorder ? null : line("Shipping", shipping ? money(shipping) : "Free")}
            <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 4 }} />
            {line("Total", money(total), true)}
            {preorder ? <Muted>Pre-order: the courier charge is added when the order is packed and you pay the balance.</Muted> : null}
            <View style={{ height: 8 }} />
          </Panel>
        ) : null}
      </Screen>
      {priced.length ? (
        <StickyBar>
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Text style={{ color: theme.colors.muted, fontSize: 11 }}>Total</Text>
            <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 18 }}>{money(total)}</Text>
          </View>
          <View style={{ flex: 1.4 }}>
            <Button icon="card-outline" label="Checkout" disabled={blocked} onPress={() => router.push("/checkout")} />
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}
