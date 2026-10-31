import { useLocalSearchParams } from "expo-router";
import { findRow, mediaUrl, money, str } from "../../src/api";
import { useCart } from "../../src/cart";
import { useFeed } from "../../src/feed";
import { Button, Cover, Empty, Loading, Muted, PageHeader, Price, QtyStepper, Screen, StatusChip } from "../../src/ui";
import { useState } from "react";

export default function BookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, loading, refresh } = useFeed();
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const item = findRow(feed?.books, String(id ?? ""));
  if (loading && !feed) return <Loading />;
  if (!item) {
    return (
      <Screen>
        <Empty icon="book-outline" label="This publication is not in the published app feed." />
      </Screen>
    );
  }
  const original = Number(item.originalPrice) || 0;
  const price = Number(item.price) || 0;
  const gallery = Array.isArray(item.media) ? (item.media as { src?: string; type?: string }[]).filter((row) => row.type !== "video" && str(row.src)) : [];
  const out = item.active === false || str(item.stockStatus) === "out_of_stock";
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Cover uri={mediaUrl(item.coverImage) || undefined} ratio="square" />
      {gallery.slice(0, 4).map((row) => (
        <Cover key={str(row.src)} uri={mediaUrl(row.src) || undefined} height={160} />
      ))}
      <PageHeader kicker={str(item.category, "Publication")} title={str(item.title)} subtitle={str(item.author)} />
      <Price value={money(price)} original={original > price ? money(original) : undefined} />
      <StatusChip label={str(item.availability, str(item.stockStatus))} />
      {item.pages ? <Muted>{String(item.pages)} pages</Muted> : null}
      <Muted>{str(item.description)}</Muted>
      {out ? (
        <Muted>This publication is not available in the published catalogue right now.</Muted>
      ) : (
        <>
          <QtyStepper value={qty} onChange={setQty} />
          <Button
            icon="bag-handle-outline"
            label="Add to bag"
            onPress={() => {
              for (let i = 0; i < qty; i += 1) cart.add({ id: str(item.id), title: str(item.title), price });
            }}
          />
        </>
      )}
    </Screen>
  );
}
