import { useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { datesHidden, mediaUrl, money, orderable, preorderable, preorderDeliveryDate, str, type Row, offerPrice } from "../../src/api";
import { TopBar } from "../../src/chrome";
import { useFeed } from "../../src/feed";
import { Chip, Empty, Loading, PageHeader, ProductTile, Screen, SearchBar, SiteFooter } from "../../src/ui";

export function productBadge(item: Row) {
  if (preorderable(item)) return { label: "Pre-order", tone: "gold" as const };
  if (!orderable(item)) return { label: "Out of stock", tone: "red" as const };
  return { label: "In stock", tone: "green" as const };
}

export function productLine(item: Row, hidePreorderDate = false) {
  if (preorderable(item)) return hidePreorderDate ? "" : `Tentative delivery by ${preorderDeliveryDate(item)}`;
  if (!orderable(item)) return "";
  return item.storePickupAvailable === false ? "Home delivery" : "Store pickup available";
}

export function ProductGrid({ items }: { items: Row[] }) {
  const { feed } = useFeed();
  const hidePreorderDate = datesHidden(feed, true);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
      {items.map((item) => {
        const price = offerPrice(item);
        const original = Number(item.originalPrice) || 0;
        return (
          <ProductTile
            key={str(item.id)}
            title={str(item.title)}
            author={str(item.author)}
            uri={mediaUrl(item.coverImage) || undefined}
            price={money(price)}
            original={original > price ? money(original) : undefined}
            badge={productBadge(item)}
            line={productLine(item, hidePreorderDate)}
            onPress={() => router.push(`/book/${str(item.id)}`)}
          />
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
    <Screen refreshing={loading} onRefresh={refresh}>
      <TopBar bag />
      <PageHeader kicker="Shop" title="Publications" subtitle="Books and clinical publications from the Foundation, delivered to your door or ready for store pickup." />
      <SearchBar value={query} onChange={setQuery} placeholder="Search by title, author or SKU" />
      {categories.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <Chip label="All" selected={!category} onPress={() => setCategory("")} />
          {categories.map((name) => (
            <Chip key={name} label={name} selected={category === name} onPress={() => setCategory(name)} />
          ))}
        </View>
      ) : null}
      <ProductGrid items={filtered} />
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
