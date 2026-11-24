import { useState } from "react";
import { Image, Pressable, Share, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { datesHidden, findRow, getApiBase, mediaUrl, money, offerLabel, offerPrice, orderable, preorderable, preorderDeliveryDate, productPolicy, productRating, str } from "../../src/api";
import { useCart } from "../../src/cart";
import { useFeed } from "../../src/feed";
import { useWishlist } from "../../src/wishlist";
import { Banner, Empty, InfoRow, Loading, QtyStepper, Screen } from "../../src/ui";

const FK_BLUE = "#8F2D2D";
const FK_GREEN = "#067D62";
const FK_ORANGE = "#8F2D2D";
const FK_TEXT = "#111827";
const FK_MUTED = "#6B7280";
const FK_BORDER = "#E5E7EB";

export default function BookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, loading, refresh } = useFeed();
  const cart = useCart();
  const wishlist = useWishlist();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const item = findRow(feed?.books, String(id ?? ""));

  if (loading && !feed) return <Loading />;
  if (!item) {
    return (
      <Screen>
        <Empty icon="book-outline" label="This publication is not in the shop." />
      </Screen>
    );
  }

  const original = Number(item.originalPrice) || 0;
  const price = offerPrice(item);
  const offer = offerLabel(item);
  const stars = productRating(feed, item);
  const policy = productPolicy(feed, item);
  const isBook = item.productType !== "other";
  const discount = original > price && original ? Math.round(((original - price) / original) * 100) : 0;
  const preorder = preorderable(item);
  const canBuy = orderable(item);
  const product = { id: str(item.id), title: str(item.title), price };
  const saved = wishlist.has(product.id);
  const publisher = (item.publisher ?? {}) as { name?: string };
  const pages = Number(item.pages) || 0;
  const coverUri = mediaUrl(item.coverImage);

  const addToCart = () => {
    cart.add(product, qty);
    setNote(preorder ? "Pre-order added to your cart." : "Added to your cart.");
  };
  const buyNow = () => {
    cart.add(product, qty);
    router.push("/cart");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F1F3F6" }}>
      <Screen refreshing={loading} onRefresh={refresh}>
        {/* Full-bleed Flipkart Image Stage with Floating Heart & Share */}
        <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, marginTop: -8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, marginBottom: 8, borderBottomWidth: 1, borderColor: FK_BORDER }}>
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 8, position: "relative" }}>
            <View style={{ width: 220, aspectRatio: 0.76, borderRadius: 12, overflow: "hidden", backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: FK_BORDER }}>
              {coverUri ? (
                <Image source={{ uri: coverUri }} accessibilityLabel={str(item.title)} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              ) : (
                <View style={{ flex: 1, backgroundColor: "#FAF7F2", alignItems: "center", justifyContent: "center", padding: 16 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: "#FDF2F4", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Ionicons name="book-outline" size={28} color="#8F2D2D" />
                  </View>
                  <Text style={{ color: "#111827", fontWeight: "800", fontSize: 16, textAlign: "center" }}>{str(item.title)}</Text>
                </View>
              )}
            </View>

            <View style={{ position: "absolute", right: 0, top: 4, gap: 10 }}>
              <Pressable
                onPress={() => wishlist.toggle(product.id)}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: FK_BORDER, alignItems: "center", justifyContent: "center", elevation: 2 }}
              >
                <Ionicons name={saved ? "heart" : "heart-outline"} size={20} color={saved ? "#E11D48" : FK_MUTED} />
              </Pressable>
              <Pressable
                onPress={() => {
                  const url = `${getApiBase()}/shop/${encodeURIComponent(str(item.slug, str(item.id)))}`;
                  void Share.share({ title: str(item.title), message: `${str(item.title)} · ${money(price)}\n${url}`, url }).catch(() => undefined);
                }}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: FK_BORDER, alignItems: "center", justifyContent: "center", elevation: 2 }}
              >
                <Ionicons name="share-social-outline" size={19} color={FK_MUTED} />
              </Pressable>
            </View>
          </View>

          <Text style={{ color: FK_MUTED, fontSize: 12, fontWeight: "700", marginTop: 10 }}>{str(item.category, "VGMF Publication")}</Text>
          <Text style={{ fontSize: 19, lineHeight: 25, fontWeight: "700", color: FK_TEXT, marginTop: 3 }}>{str(item.title)}</Text>
          {isBook && str(item.author) ? <Text style={{ color: FK_MUTED, fontSize: 13, marginTop: 2 }}>{str(item.author)}</Text> : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
            <View style={{ backgroundColor: FK_GREEN, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2.5, flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>{stars.ratings ? stars.rating : "4.9"}</Text>
              <Ionicons name="star" size={11} color="#FFFFFF" />
            </View>
            <Text style={{ color: FK_MUTED, fontSize: 12.5 }}>
              {stars.ratings ? `${stars.ratings} ratings & ${stars.written} reviews` : "VGMF Official Publication"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 10 }}>
            <Text style={{ fontSize: 24, fontWeight: "900", color: FK_TEXT }}>{money(price)}</Text>
            {original > price ? <Text style={{ fontSize: 15, color: FK_MUTED, textDecorationLine: "line-through" }}>{money(original)}</Text> : null}
            {discount ? <Text style={{ fontSize: 15, fontWeight: "800", color: FK_GREEN }}>{discount}% off</Text> : null}
          </View>
          {offer ? <Text style={{ color: FK_GREEN, fontSize: 12, fontWeight: "700", marginTop: 2 }}>{offer}</Text> : null}
          <Text style={{ color: FK_MUTED, fontSize: 11.5, marginTop: 2 }}>Inclusive of all taxes</Text>

          {canBuy ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: FK_BORDER }}>
              <Text style={{ color: FK_TEXT, fontWeight: "700", fontSize: 14 }}>Quantity</Text>
              <QtyStepper value={qty} onChange={setQty} />
            </View>
          ) : null}

          {note ? <View style={{ marginTop: 10 }}><Banner text={note} tone="success" /></View> : null}
        </View>

        {/* Flipkart 3-Column Trust Strip */}
        <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8, flexDirection: "row", justifyContent: "space-around", borderTopWidth: 1, borderBottomWidth: 1, borderColor: FK_BORDER }}>
          {[
            { icon: "return-down-back-outline" as const, label: policy.returns ? `${policy.windowDays}-Day Return` : "Replacement" },
            { icon: "shield-checkmark-outline" as const, label: "100% Authentic" },
            { icon: "lock-closed-outline" as const, label: "Razorpay Safe" },
          ].map((b) => (
            <View key={b.label} style={{ alignItems: "center", gap: 5, width: "31%" }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#EEF4FF", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={b.icon} size={18} color={FK_BLUE} />
              </View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: FK_TEXT, textAlign: "center" }}>{b.label}</Text>
            </View>
          ))}
        </View>

        {/* Delivery & Services Band */}
        <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FK_BORDER }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: FK_TEXT, marginBottom: 4 }}>Delivery &amp; Services</Text>
          {preorder ? (
            <>
              <InfoRow icon="time-outline" label="Pre-order delivery" value={datesHidden(feed, true) ? "Shared once dispatched" : preorderDeliveryDate(item)} />
              <InfoRow icon="information-circle-outline" label="Pre-order terms" value="Pay advance now; balance + courier charge is paid when packed." />
            </>
          ) : (
            <InfoRow icon="cube-outline" label="Home delivery" value={canBuy ? "Estimated delivery date shown at checkout" : "Out of stock right now"} />
          )}
          {item.storePickupAvailable !== false && canBuy ? (
            <InfoRow icon="storefront-outline" label="Store pickup" value="Available at VGMF Store, Pune" />
          ) : null}
        </View>

        {/* Specifications Band */}
        <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FK_BORDER }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: FK_TEXT, marginBottom: 4 }}>Product Specifications</Text>
          <InfoRow icon="barcode-outline" label="SKU" value={str(item.sku)} />
          <InfoRow icon="layers-outline" label="Batch no." value={str(item.batchNo)} />
          <InfoRow icon="language-outline" label="Language" value={str(item.language)} />
          <InfoRow icon="library-outline" label="Binding" value={isBook ? str(item.binding) : ""} />
          <InfoRow icon="document-outline" label="Pages" value={isBook && pages ? String(pages) : ""} />
          <InfoRow icon="business-outline" label="Publisher" value={isBook ? str(publisher.name, "VGMF Publications") : ""} />
        </View>

        {str(item.description) ? (
          <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: FK_BORDER }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: FK_TEXT, marginBottom: 6 }}>About this book</Text>
            <Text style={{ color: "#374151", fontSize: 13.5, lineHeight: 21 }}>{str(item.description)}</Text>
          </View>
        ) : null}
      </Screen>

      {/* Exact Flipkart 50/50 Split Sticky Bottom CTA Bar */}
      {canBuy ? (
        <View style={{ flexDirection: "row", backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: FK_BORDER, elevation: 12 }}>
          <Pressable
            onPress={addToCart}
            style={({ pressed }) => ({
              flex: 1,
              height: 54,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="cart-outline" size={19} color={FK_TEXT} />
            <Text style={{ color: FK_TEXT, fontSize: 15, fontWeight: "800" }}>Add to Cart</Text>
          </Pressable>
          <Pressable
            onPress={buyNow}
            style={({ pressed }) => ({
              flex: 1,
              height: 54,
              backgroundColor: FK_ORANGE,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Ionicons name="flash" size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "800" }}>{preorder ? "Pre-order Now" : "Buy Now"}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
