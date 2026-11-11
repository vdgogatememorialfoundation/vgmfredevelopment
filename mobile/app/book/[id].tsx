import { useState } from "react";
import { Share, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { datesHidden, findRow, getApiBase, mediaUrl, money, offerLabel, offerPrice, orderable, preorderable, preorderDeliveryDate, productPolicy, productRating, str } from "../../src/api";
import { useCart } from "../../src/cart";
import { useFeed } from "../../src/feed";
import { useTheme } from "../../src/theme";
import { useWishlist } from "../../src/wishlist";
import { Banner, Body, Button, CoverArt, Empty, InfoRow, Kicker, Loading, Muted, Panel, Price, QtyStepper, Screen, StickyBar, Tag } from "../../src/ui";
import { productBadge } from "../(tabs)/shop";

export default function BookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, loading, refresh } = useFeed();
  const theme = useTheme();
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
  const pickupDates = ((feed?.orderSettings ?? {}) as { pickupDates?: { inStock?: boolean; preorder?: boolean } }).pickupDates ?? {};
  const discount = original > price && original ? Math.round(((original - price) / original) * 100) : 0;
  const preorder = preorderable(item);
  const canBuy = orderable(item);
  const product = { id: str(item.id), title: str(item.title), price };
  const saved = wishlist.has(product.id);
  const publisher = (item.publisher ?? {}) as { name?: string };
  const plan = (item.preorder ?? {}) as { note?: string; releaseDate?: string };
  const pages = Number(item.pages) || 0;

  const addToCart = () => {
    cart.add(product, qty);
    setNote(preorder ? "Pre-order added to your cart." : "Added to your cart.");
  };
  const buyNow = () => {
    cart.add(product, qty);
    router.push("/cart");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Screen refreshing={loading} onRefresh={refresh}>
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <View style={{ width: "68%" }}>
            <CoverArt uri={mediaUrl(item.coverImage) || undefined} title={str(item.title)} ratio={0.75} radius={18} />
          </View>
        </View>
        <View style={{ height: 14 }} />
        <Kicker>{str(item.category, "Publication")}</Kicker>
        <Text style={{ fontSize: 26, lineHeight: 32, fontWeight: "600", color: theme.colors.text, fontFamily: theme.fontFamily }}>{str(item.title)}</Text>
        {isBook ? <Muted>{str(item.author)}</Muted> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
          {stars.ratings ? (
            <>
              <Tag label={`${stars.rating} ★`} tone="green" />
              <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                {"★★★★★".slice(0, Math.round(stars.rating))}{"☆☆☆☆☆".slice(0, 5 - Math.round(stars.rating))} · {stars.ratings} rating{stars.ratings === 1 ? "" : "s"} & {stars.written} review{stars.written === 1 ? "" : "s"}
              </Text>
            </>
          ) : (
            <Text style={{ color: theme.colors.muted, fontSize: 12 }}>No ratings yet</Text>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
          <Price value={money(price)} original={original > price ? money(original) : undefined} />
          {discount ? <Tag label={`${discount}% off`} tone="green" /> : null}
          {offer ? <Tag label={offer} tone="green" /> : null}
        </View>
        <Text style={{ color: theme.colors.muted, fontSize: 11, marginTop: 2 }}>Inclusive of all taxes</Text>
        <View style={{ marginTop: 10 }}>
          <Tag {...productBadge(item)} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <Button
            kind="ghost"
            icon="share-social-outline"
            label="Share"
            onPress={() => {
              const url = `${getApiBase()}/shop/${encodeURIComponent(str(item.slug, str(item.id)))}`;
              void Share.share({ title: str(item.title), message: `${str(item.title)} · ${money(price)}\n${url}`, url }).catch(() => undefined);
            }}
          />
        </View>
        <Banner text={note} tone="success" />

        <View style={{ height: 14 }} />
        <Panel title="Delivery">
          {preorder ? (
            <>
              {datesHidden(feed, true) ? (
                <InfoRow icon="time-outline" label="Delivery date" value="Shared once your order is dispatched" />
              ) : (
                <InfoRow icon="time-outline" label="Tentative delivery by" value={preorderDeliveryDate(item)} />
              )}
              <InfoRow icon="information-circle-outline" label="How pre-orders work" value="Pay for the item now. When it is packed you pay the balance with the courier charge." />
              {plan.note ? <InfoRow icon="chatbox-ellipses-outline" label="Note" value={plan.note} /> : null}
            </>
          ) : canBuy ? (
            <InfoRow icon="cube-outline" label="Home delivery" value="Delivery date is shown at checkout for your pincode" />
          ) : (
            <InfoRow icon="alert-circle-outline" label="Availability" value="Out of stock right now" />
          )}
          {item.storePickupAvailable !== false && canBuy ? <InfoRow icon="storefront-outline" label="Store pickup" value={(preorder ? pickupDates.preorder : pickupDates.inStock) ? "Available at the Foundation, Pune" : "Available at the Foundation, Pune · we'll tell you when it's ready to collect"} /> : null}
        </Panel>

        <Panel title="Returns & cancellation">
          <InfoRow icon={policy.returns ? "checkmark-circle-outline" : "close-circle-outline"} label="Return" value={policy.returns ? `${policy.windowDays}-day return after delivery` : "Not returnable"} />
          <InfoRow icon={policy.replacement ? "checkmark-circle-outline" : "close-circle-outline"} label="Replacement" value={policy.replacement ? "Damaged or wrong items can be replaced after photos are reviewed" : "No replacement"} />
          <InfoRow icon={policy.cancellation ? "checkmark-circle-outline" : "close-circle-outline"} label="Cancellation" value={policy.cancellation ? "Can be cancelled before dispatch" : "Cannot be cancelled once ordered"} />
          {str((item.policy as { note?: string } | undefined)?.note) ? <InfoRow icon="information-circle-outline" label="Note" value={str((item.policy as { note?: string } | undefined)?.note)} /> : null}
        </Panel>

        <Panel title="Details">
          <InfoRow icon="barcode-outline" label="SKU" value={str(item.sku)} />
          <InfoRow icon="library-outline" label="Binding" value={isBook ? str(item.binding) : ""} />
          <InfoRow icon="language-outline" label="Language" value={str(item.language)} />
          <InfoRow icon="document-outline" label="Pages" value={isBook && pages ? String(pages) : ""} />
          <InfoRow icon="business-outline" label="Publisher" value={isBook ? str(publisher.name) : ""} />
          <InfoRow icon="calendar-outline" label="Published" value={[str(item.edition), str(item.publishedYear)].filter(Boolean).join(" · ")} />
        </Panel>

        {str(item.description) ? (
          <Panel title="About this publication">
            <Body>{str(item.description)}</Body>
            <View style={{ height: 10 }} />
          </Panel>
        ) : null}

        {canBuy ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: theme.colors.text, fontWeight: "700" }}>Quantity</Text>
            <QtyStepper value={qty} onChange={setQty} />
          </View>
        ) : null}
        <Button
          kind="ghost"
          icon={saved ? "heart" : "heart-outline"}
          label={saved ? "Saved to wishlist" : "Add to wishlist"}
          onPress={() => wishlist.toggle(product.id)}
        />
      </Screen>
      {canBuy ? (
        <StickyBar>
          <View style={{ flex: 1 }}>
            <Button kind="ghost" icon="bag-add-outline" label="Add to cart" onPress={addToCart} />
          </View>
          <View style={{ flex: 1 }}>
            <Button icon="flash-outline" label={preorder ? "Pre-order now" : "Buy now"} onPress={buyNow} />
          </View>
        </StickyBar>
      ) : null}
    </View>
  );
}
