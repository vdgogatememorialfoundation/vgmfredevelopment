import { useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { datesHidden, mediaUrl, money, offerPrice, orderable, preorderable, preorderDeliveryDate, productRating, str, type Row } from "../../src/api";
import { useCart } from "../../src/cart";
import { FloatingCartStrip, TopBar } from "../../src/chrome";
import { useFeed } from "../../src/feed";
import { useWishlist } from "../../src/wishlist";
import { Chip, Empty, Loading, Screen, SearchBar, SiteFooter } from "../../src/ui";

const BRAND = "#8F2D2D";
const GREEN = "#067D62";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

export function productBadge(item: Row) {
  if (preorderable(item)) return { label: "Pre-order", tone: "gold" as const };
  if (!orderable(item)) return { label: "Out of stock", tone: "red" as const };
  return { label: "In stock", tone: "green" as const };
}

export function productRibbons(item: Row) {
  const out: { label: string; color: string }[] = [];
  if (item.trending) out.push({ label: "Trending", color: "#067D62" });
  const until = str(item.newUntil);
  if (item.isNew && (!until || Date.parse(`${until}T23:59:59`) >= Date.now())) out.push({ label: "New", color: "#8F2D2D" });
  if (str(item.ribbon).trim()) out.push({ label: str(item.ribbon).trim(), color: "#D97706" });
  return out;
}

export function productLine(item: Row, hidePreorderDate = false) {
  if (preorderable(item)) return hidePreorderDate ? "Pre-order available" : `Delivery by ${preorderDeliveryDate(item)}`;
  if (!orderable(item)) return "Currently unavailable";
  return item.storePickupAvailable === false ? "Home delivery" : "Free pickup · Home delivery";
}

/** Pure White Consumer E-Commerce Product Grid (Zero dark backgrounds, Wishlist heart, Star rating, % off, 1-tap Add). */
export function ProductGrid({ items }: { items: Row[] }) {
  const { feed } = useFeed();
  const cart = useCart();
  const wishlist = useWishlist();
  const hidePreorderDate = datesHidden(feed, true);

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
      {items.map((item) => {
        const id = str(item.id);
        const title = str(item.title);
        const price = offerPrice(item);
        const original = Number(item.originalPrice) || 0;
        const pct = original > price && price > 0 ? Math.round(((original - price) / original) * 100) : 0;
        const uri = mediaUrl(item.coverImage);
        const saved = wishlist.has(id);
        const canBuy = orderable(item);
        const stars = productRating(feed, item);
        const inCart = cart.items.find((c) => c.id === id);

        return (
          <Pressable
            key={id}
            onPress={() => router.push(`/book/${id}`)}
            style={({ pressed }) => ({
              width: "48.8%",
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: BORDER,
              overflow: "hidden",
              opacity: pressed ? 0.94 : 1,
            })}
          >
            <View style={{ width: "100%", aspectRatio: 0.88, backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center", position: "relative" }}>
              {uri ? (
                <Image source={{ uri }} accessibilityLabel={title} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              ) : (
                <View style={{ flex: 1, width: "100%", backgroundColor: "#FAF7F2", alignItems: "center", justifyContent: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: "#FDF2F4", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                    <Ionicons name="book-outline" size={22} color={BRAND} />
                  </View>
                  <Text numberOfLines={3} style={{ color: TEXT, fontWeight: "800", fontSize: 12.5, textAlign: "center" }}>{title}</Text>
                </View>
              )}

              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  wishlist.toggle(id);
                }}
                hitSlop={8}
                accessibilityLabel={saved ? "Remove from wishlist" : "Add to wishlist"}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: BORDER,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={saved ? "heart" : "heart-outline"} size={16} color={saved ? "#E11D48" : MUTED} />
              </Pressable>

              {preorderable(item) ? (
                <View style={{ position: "absolute", left: 8, top: 8, backgroundColor: "#FEFCE8", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: "#A16207", fontSize: 9, fontWeight: "800", textTransform: "uppercase" }}>Pre-order</Text>
                </View>
              ) : null}
            </View>

            <View style={{ padding: 10 }}>
              <Text numberOfLines={2} style={{ color: TEXT, fontSize: 13, fontWeight: "700", lineHeight: 18, minHeight: 36 }}>
                {title}
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                <View style={{ backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#BBF7D0", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1.5, flexDirection: "row", alignItems: "center", gap: 2 }}>
                  <Text style={{ color: GREEN, fontSize: 10, fontWeight: "800" }}>{stars.ratings ? stars.rating : "4.9"}</Text>
                  <Ionicons name="star" size={9} color={GREEN} />
                </View>
                <Text style={{ color: MUTED, fontSize: 10.5 }} numberOfLines={1}>
                  {stars.ratings ? `(${stars.ratings})` : "Official"}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                <Text style={{ color: TEXT, fontSize: 15.5, fontWeight: "800" }}>{money(price)}</Text>
                {original > price ? <Text style={{ color: MUTED, fontSize: 11.5, textDecorationLine: "line-through" }}>{money(original)}</Text> : null}
                {pct >= 5 ? <Text style={{ color: GREEN, fontSize: 11.5, fontWeight: "800" }}>{pct}% off</Text> : null}
              </View>

              <Text numberOfLines={1} style={{ color: MUTED, fontSize: 10.5, marginTop: 3 }}>
                {productLine(item, hidePreorderDate)}
              </Text>

              {canBuy ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    cart.add({ id, title, price }, 1);
                  }}
                  style={({ pressed }) => ({
                    marginTop: 8,
                    borderWidth: 1,
                    borderColor: inCart ? GREEN : BRAND,
                    backgroundColor: inCart ? "#ECFDF5" : "#FDF2F4",
                    borderRadius: 8,
                    paddingVertical: 6.5,
                    alignItems: "center",
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ color: inCart ? GREEN : BRAND, fontSize: 11.5, fontWeight: "800" }}>
                    {inCart ? `In Cart (${inCart.quantity}) +` : "Add to Cart"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ShopScreen() {
  const { feed, loading, refresh } = useFeed();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const items = useMemo(() => feed?.books ?? [], [feed?.books]);
  const categories = useMemo(() => Array.from(new Set(items.map((item) => str(item.category)).filter(Boolean))), [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category && str(item.category) !== category) return false;
      if (!q) return true;
      return [item.title, item.author, item.category, item.description, item.sku].some((value) => str(value).toLowerCase().includes(q));
    });
  }, [items, query, category]);

  if (loading && !feed) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FB" }}>
      <Screen refreshing={loading} onRefresh={refresh}>
        <TopBar bag />
        <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderColor: BORDER }}>
          <SearchBar value={query} onChange={setQuery} placeholder="Filter by title, author or SKU" />
          {categories.length > 1 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              <Chip label={`All (${items.length})`} selected={!category} onPress={() => setCategory("")} />
              {categories.map((name) => (
                <Chip key={name} label={name} selected={category === name} onPress={() => setCategory(name)} />
              ))}
            </View>
          ) : null}
          <ProductGrid items={filtered} />
          {!filtered.length ? (
            <Empty
              icon="book-outline"
              label={items.length ? "No publications match that search." : "No titles are in the shop yet. Pull to refresh."}
              actionLabel="Refresh"
              onAction={() => void refresh()}
            />
          ) : null}
        </View>
        <SiteFooter />
        <View style={{ height: 64 }} />
      </Screen>
      <FloatingCartStrip />
    </View>
  );
}
