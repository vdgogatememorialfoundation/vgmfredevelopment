import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { mediaUrl, money, str, type Row } from "../../src/api";
import { TopBar } from "../../src/chrome";
import { useFeed } from "../../src/feed";
import { useTheme } from "../../src/theme";
import { Cover, Empty, Heading, Loading, Muted, PageHeader, Price, Screen, SearchBar, SiteFooter, StatusChip } from "../../src/ui";

export default function ShopScreen() {
  const { feed, loading, refresh } = useFeed();
  const [query, setQuery] = useState("");
  const items = feed?.books ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [item.title, item.author, item.category, item.description, item.sku].some((value) => str(value).toLowerCase().includes(q)));
  }, [items, query]);
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <TopBar bag />
      <PageHeader kicker="Shop" title="Publications" subtitle="Choose a title to read the details, then add it to the cart or buy now." />
      <SearchBar value={query} onChange={setQuery} placeholder="Search by title or author" />
      {filtered.map((item) => (
        <ProductRow key={str(item.id)} item={item} />
      ))}
      {!filtered.length ? (
        <Empty
          icon="book-outline"
          label={items.length ? "No publications match that search." : "No titles are in the shop yet. Pull to refresh after Admin publishes."}
          actionLabel="Refresh"
          onAction={() => void refresh()}
        />
      ) : null}
      <SiteFooter />
    </Screen>
  );
}

function ProductRow({ item }: { item: Row }) {
  const theme = useTheme();
  const original = Number(item.originalPrice) || 0;
  const price = Number(item.price) || 0;
  const out = str(item.stockStatus) === "out_of_stock" || item.active === false;
  const discount = original > price && original ? Math.round(((original - price) / original) * 100) : 0;
  return (
    <Pressable onPress={() => router.push(`/book/${str(item.id)}`)} accessibilityRole="button" accessibilityLabel={str(item.title)}>
      <View style={{ backgroundColor: theme.colors.paper, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: theme.colors.muted, fontSize: 11, fontWeight: "700" }}>{str(item.category, "Publication")}</Text>
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
            <Muted>{out ? "Out of stock" : "Tap to view details"}</Muted>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
