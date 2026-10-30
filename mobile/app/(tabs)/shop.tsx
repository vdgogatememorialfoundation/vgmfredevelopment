import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { mediaUrl, money, str, type Row } from "../../src/api";
import { useCart } from "../../src/cart";
import { useFeed } from "../../src/feed";
import { Button, Cover, Empty, Heading, Loading, Muted, Screen, SearchBar, SectionHeader } from "../../src/ui";
import { useTheme } from "../../src/theme";

export default function ShopScreen() {
  const { feed, loading, refresh } = useFeed();
  const cart = useCart();
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const items = feed?.books ?? [];
  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((item) => str(item.category)).filter(Boolean)))], [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "All" && str(item.category) !== category) return false;
      if (!q) return true;
      return [item.title, item.author, item.category, item.description].some((value) => str(value).toLowerCase().includes(q));
    });
  }, [items, query, category]);
  if (loading && !feed) return <Loading />;
  const width = theme.columns === 2 ? ("48%" as const) : ("100%" as const);
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <SectionHeader title={theme.labels.shop} />
        <Button label={`${theme.labels.bag} ${cart.count}`} kind="ghost" onPress={() => router.push("/cart")} />
      </View>
      <SearchBar value={query} onChange={setQuery} placeholder="Search publications" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {categories.map((item) => (
          <Pressable
            key={item}
            onPress={() => setCategory(item)}
            style={{
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: category === item ? theme.colors.primary : theme.colors.paper,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text style={{ color: category === item ? theme.colors.onPrimary : theme.colors.text, fontWeight: "700", fontSize: 12 }}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {filtered.map((item) => (
          <ProductCard key={str(item.id)} item={item} width={width} />
        ))}
      </View>
      {!filtered.length ? (
        <Empty
          label={items.length ? "No publications match that search." : "No publications are currently in the published catalogue. Pull to refresh after Admin publishes."}
          actionLabel="Refresh"
          onAction={() => void refresh()}
        />
      ) : null}
    </Screen>
  );
}

function ProductCard({ item, width }: { item: Row; width: `${number}%` }) {
  const theme = useTheme();
  const original = Number(item.originalPrice) || 0;
  const price = Number(item.price) || 0;
  const out = str(item.stockStatus) === "out_of_stock" || item.active === false;
  return (
    <Pressable onPress={() => router.push(`/book/${str(item.id)}`)} style={{ width }}>
      <View style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.lg, padding: 10, marginBottom: 8 }}>
        <Cover uri={mediaUrl(item.coverImage) || undefined} ratio="square" />
        <Heading>{str(item.title)}</Heading>
        <Muted>{str(item.author)}</Muted>
        <Text style={{ color: theme.colors.primary, fontWeight: "800", marginTop: 6 }}>{money(price)}</Text>
        {original > price ? <Muted>{money(original)}</Muted> : null}
        {out ? <Muted>Out of stock</Muted> : str(item.stockStatus) === "in_stock" ? <Muted>In stock</Muted> : null}
      </View>
    </Pressable>
  );
}
