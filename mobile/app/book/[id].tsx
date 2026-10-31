import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { findRow, mediaUrl, money, str } from "../../src/api";
import { useCart } from "../../src/cart";
import { useFeed } from "../../src/feed";
import { useWishlist } from "../../src/wishlist";
import { Banner, Button, Cover, Empty, Loading, Muted, PageHeader, Price, QtyStepper, Screen, StatusChip } from "../../src/ui";

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
  const price = Number(item.price) || 0;
  const gallery = Array.isArray(item.media) ? (item.media as { src?: string; type?: string }[]).filter((row) => row.type !== "video" && str(row.src)) : [];
  const out = item.active === false || str(item.stockStatus) === "out_of_stock";
  const product = { id: str(item.id), title: str(item.title), price };
  const saved = wishlist.has(product.id);

  const addToCart = () => {
    cart.add(product, qty);
    setNote("Added to cart. Open the cart when you are ready to checkout.");
  };

  const buyNow = () => {
    cart.add(product, qty);
    router.push("/cart");
  };

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Cover uri={mediaUrl(item.coverImage) || undefined} ratio="square" />
      {gallery.slice(0, 4).map((row) => (
        <Cover key={str(row.src)} uri={mediaUrl(row.src) || undefined} height={160} />
      ))}
      <PageHeader kicker={str(item.category, "Publication")} title={str(item.title)} subtitle={str(item.author)} />
      <Price value={money(price)} original={original > price ? money(original) : undefined} />
      <StatusChip label={str(item.availability, str(item.stockStatus, out ? "Out of stock" : "Available"))} />
      {item.pages ? <Muted>{String(item.pages)} pages</Muted> : null}
      <Muted>{str(item.description)}</Muted>
      <Banner text={note} tone="success" />
      {out ? (
        <Muted>This publication is not available right now.</Muted>
      ) : (
        <>
          <QtyStepper value={qty} onChange={setQty} />
          <View style={{ gap: 8, marginTop: 8 }}>
            <Button icon="bag-handle-outline" label="Add to cart" onPress={addToCart} />
            <Button kind="ink" icon="cart-outline" label="Buy now" onPress={buyNow} />
          </View>
        </>
      )}
      <Button
        kind="ghost"
        icon={saved ? "heart" : "heart-outline"}
        label={saved ? "Saved to wishlist" : "Add to wishlist"}
        onPress={() => wishlist.toggle(product.id)}
      />
    </Screen>
  );
}
