import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { mediaUrl, money, str, type Row } from "../../src/api";
import { useCart } from "../../src/cart";
import { GoldBanner, TopBar } from "../../src/chrome";
import { useFeed } from "../../src/feed";
import { STORE } from "../../src/site-content";
import { useTheme } from "../../src/theme";
import { Button, Card, Chip, Cover, Empty, Heading, Loading, Muted, PageHeader, Price, Screen, SearchBar, SiteFooter, StatusChip } from "../../src/ui";

export default function ShopScreen() {
  const { feed, loading, refresh } = useFeed();
  const cart = useCart();
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All publications");
  const items = feed?.books ?? [];
  const categories = useMemo(() => ["All publications", ...Array.from(new Set(items.map((item) => str(item.category)).filter(Boolean)))], [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "All publications" && str(item.category) !== category) return false;
      if (!q) return true;
      return [item.title, item.author, item.category, item.description, item.sku].some((value) => str(value).toLowerCase().includes(q));
    });
  }, [items, query, category]);
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <GoldBanner text={`Free shipping on orders over ₹${STORE.freeShippingThreshold}`} action="View bag" onAction={() => router.push("/cart")} />
      <TopBar bag />
      <PageHeader kicker="Official archival press" title="Foundation publications" subtitle="Authentic Ayurvedic treatises, critical commentaries and research monographs published by the Vaidya Gogate Memorial Foundation." />
      <SearchBar value={query} onChange={setQuery} placeholder="Search by title, author or code" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {categories.map((item) => (
          <Chip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />
        ))}
      </View>
      {filtered.map((item) => (
        <ProductRow key={str(item.id)} item={item} onAdd={() => cart.add({ id: str(item.id), title: str(item.title), price: Number(item.price) || 0 })} />
      ))}
      {!filtered.length ? (
        <Empty
          icon="book-outline"
          label={items.length ? "No publications match that search." : "No titles are in the published catalogue yet. Pull to refresh after Admin publishes, then checkout with Razorpay in the app."}
          actionLabel="Refresh"
          onAction={() => void refresh()}
        />
      ) : null}
      <Card>
        <Heading>In-app checkout</Heading>
        <Muted>Pay with Razorpay inside VGMF — UPI, cards, net banking and wallets. Free shipping over ₹{STORE.freeShippingThreshold}.</Muted>
        <Button icon="bag-handle-outline" label="Open bag and pay" onPress={() => router.push("/cart")} />
      </Card>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        {[
          [`${STORE.returnDays}-day return`, "Archival reprint guarantee"],
          [`${STORE.gstRate} GST incl.`, "Official institutional copy"],
          [STORE.courier, "Standard track"],
        ].map(([title, body]) => (
          <View key={title} style={{ flex: 1, backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 10 }}>
            <Text style={{ fontWeight: "800", fontSize: 12, color: theme.colors.text }}>{title}</Text>
            <Text style={{ color: theme.colors.muted, fontSize: 11, marginTop: 4 }}>{body}</Text>
          </View>
        ))}
      </View>
      <SiteFooter />
    </Screen>
  );
}

function ProductRow({ item, onAdd }: { item: Row; onAdd: () => void }) {
  const theme = useTheme();
  const original = Number(item.originalPrice) || 0;
  const price = Number(item.price) || 0;
  const out = str(item.stockStatus) === "out_of_stock" || item.active === false;
  const discount = original > price && original ? Math.round(((original - price) / original) * 100) : 0;
  return (
    <Pressable onPress={() => router.push(`/book/${str(item.id)}`)}>
      <View style={{ backgroundColor: theme.colors.paper, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: theme.colors.muted, fontSize: 11, fontWeight: "700" }}>{str(item.sku, str(item.id))}</Text>
          {discount ? <StatusChip label={`${discount}% off`} /> : null}
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ width: 88 }}>
            <Cover uri={mediaUrl(item.coverImage) || undefined} ratio="square" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Heading>{str(item.title)}</Heading>
            <Muted>{str(item.author)}</Muted>
            <Muted>{[str(item.format), item.pages ? `${item.pages} pages` : ""].filter(Boolean).join(" · ")}</Muted>
            <Price value={money(price)} original={original > price ? money(original) : undefined} />
          </View>
        </View>
        <Button label={out ? "Out of stock" : "Add to bag"} icon="bag-handle-outline" disabled={out} onPress={onAdd} />
      </View>
    </Pressable>
  );
}
