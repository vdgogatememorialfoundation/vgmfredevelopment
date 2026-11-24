import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { datesHidden, findRow, mediaUrl, money, offerPrice, orderable, preorderable, preorderDeliveryDate, str } from "../src/api";
import { useCart } from "../src/cart";
import { useFeed } from "../src/feed";
import { STORE } from "../src/site-content";
import { CoverArt, Empty, QtyStepper, Screen, Tag } from "../src/ui";

const FK_BLUE = "#8F2D2D";
const FK_GREEN = "#067D62";
const FK_ORANGE = "#8F2D2D";
const FK_TEXT = "#111827";
const FK_MUTED = "#6B7280";
const FK_BORDER = "#E5E7EB";

export default function CartScreen() {
  const cart = useCart();
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
    [cart.items, feed?.books],
  );

  const subtotal = priced.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const mrp = priced.reduce((sum, item) => sum + Math.max(item.original, item.price) * item.quantity, 0);
  const savings = Math.max(0, mrp - subtotal);
  const preorder = priced.some((item) => item.preorder);
  const shipping = preorder ? 0 : subtotal >= STORE.freeShippingThreshold ? 0 : STORE.shippingFee;
  const total = subtotal + shipping;
  const blocked = priced.some((item) => !item.inCatalogue || !item.canBuy);

  return (
    <View style={{ flex: 1, backgroundColor: "#F1F3F6" }}>
      <Screen>
        {!priced.length ? (
          <View style={{ marginTop: 12 }}>
            <Empty icon="cart-outline" label="Your cart is empty. Browse official VGMF publications." actionLabel="Shop now" onAction={() => router.push("/shop")} />
          </View>
        ) : (
          <>
            {priced.map((item) => {
              const pct = item.original > item.price && item.price > 0 ? Math.round(((item.original - item.price) / item.original) * 100) : 0;
              return (
                <View key={item.id} style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 0, marginBottom: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FK_BORDER }}>
                  <View style={{ flexDirection: "row", gap: 14, paddingBottom: 12 }}>
                    <View style={{ width: 78 }}>
                      <CoverArt uri={mediaUrl(item.book?.coverImage) || undefined} title={item.title} ratio={0.78} radius={8} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={2} style={{ color: FK_TEXT, fontWeight: "700", fontSize: 14.5, lineHeight: 20 }}>{item.title}</Text>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 6 }}>
                        <Text style={{ color: FK_TEXT, fontWeight: "900", fontSize: 16.5 }}>{money(item.price)}</Text>
                        {item.original > item.price ? <Text style={{ color: FK_MUTED, textDecorationLine: "line-through", fontSize: 12.5 }}>{money(item.original)}</Text> : null}
                        {pct >= 5 ? <Text style={{ color: FK_GREEN, fontWeight: "800", fontSize: 12.5 }}>{pct}% off</Text> : null}
                      </View>
                      {item.preorder ? (
                        <View style={{ marginTop: 6, gap: 3 }}>
                          <Tag label="Pre-order" tone="gold" />
                          {datesHidden(feed, true) ? null : <Text style={{ color: FK_GREEN, fontSize: 11.5, fontWeight: "700" }}>Tentative delivery by {preorderDeliveryDate(item.book)}</Text>}
                        </View>
                      ) : !item.inCatalogue ? (
                        <View style={{ marginTop: 6 }}><Tag label="No longer available" tone="red" /></View>
                      ) : !item.canBuy ? (
                        <View style={{ marginTop: 6 }}><Tag label="Out of stock" tone="red" /></View>
                      ) : (
                        <Text style={{ color: FK_GREEN, fontSize: 11.5, fontWeight: "700", marginTop: 4 }}>Delivery or store pickup</Text>
                      )}
                      <QtyStepper value={item.quantity} onChange={(value) => cart.setQuantity(item.id, value)} />
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: FK_BORDER, marginHorizontal: -16 }}>
                    <Pressable
                      onPress={() => cart.remove(item.id)}
                      style={{ flex: 1, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <Ionicons name="trash-outline" size={16} color={FK_MUTED} />
                      <Text style={{ color: FK_MUTED, fontWeight: "700", fontSize: 13 }}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            {/* Flipkart Price Details Band */}
            <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FK_BORDER }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: FK_TEXT, marginBottom: 10 }}>Price Details</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}>
                <Text style={{ color: FK_TEXT, fontSize: 13.5 }}>Price ({cart.count} {cart.count === 1 ? "item" : "items"})</Text>
                <Text style={{ color: FK_TEXT, fontSize: 13.5, fontWeight: "600" }}>{money(mrp || subtotal)}</Text>
              </View>
              {savings > 0 ? (
                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}>
                  <Text style={{ color: FK_TEXT, fontSize: 13.5 }}>Discount</Text>
                  <Text style={{ color: FK_GREEN, fontSize: 13.5, fontWeight: "700" }}>− {money(savings)}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}>
                <Text style={{ color: FK_TEXT, fontSize: 13.5 }}>Delivery Charges</Text>
                <Text style={{ color: shipping ? FK_TEXT : FK_GREEN, fontSize: 13.5, fontWeight: "700" }}>
                  {preorder ? "At dispatch" : shipping ? money(shipping) : "FREE Delivery"}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: FK_BORDER, marginVertical: 10 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: FK_TEXT, fontSize: 16, fontWeight: "800" }}>Total Amount</Text>
                <Text style={{ color: FK_TEXT, fontSize: 17, fontWeight: "900" }}>{money(total)}</Text>
              </View>
              {savings > 0 ? (
                <View style={{ marginTop: 12, backgroundColor: "#EAF7EE", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: FK_GREEN, fontSize: 12.5, fontWeight: "800" }}>
                    You will save {money(savings)} on this order
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        )}
      </Screen>

      {priced.length ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: FK_BORDER, elevation: 12 }}>
          <View>
            {mrp > total ? <Text style={{ color: FK_MUTED, fontSize: 11.5, textDecorationLine: "line-through" }}>{money(mrp)}</Text> : null}
            <Text style={{ color: FK_TEXT, fontWeight: "900", fontSize: 19 }}>{money(total)}</Text>
          </View>
          <Pressable
            disabled={blocked}
            onPress={() => router.push("/checkout")}
            style={({ pressed }) => ({
              backgroundColor: blocked ? "#CBD5E1" : FK_ORANGE,
              borderRadius: 8,
              paddingHorizontal: 28,
              paddingVertical: 13,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>Place Order</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
