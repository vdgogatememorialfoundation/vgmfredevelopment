import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { findRow, mediaUrl, money, str } from "../../src/api";
import { useCart } from "../../src/cart";
import { useFeed } from "../../src/feed";
import { Button, Cover, Empty, Loading, Muted, Screen, Title } from "../../src/ui";
import { colors } from "../../src/theme";

export default function BookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, loading, refresh } = useFeed();
  const cart = useCart();
  const item = findRow(feed?.books, String(id ?? ""));
  if (loading && !feed) return <Loading />;
  if (!item) {
    return (
      <Screen>
        <Empty label="This publication is not in the published app feed." />
      </Screen>
    );
  }
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Cover uri={mediaUrl(item.coverImage) || undefined} height={220} />
      <Title>{str(item.title)}</Title>
      <Muted>{str(item.author)}</Muted>
      <Text style={{ color: colors.burgundy, fontWeight: "800", marginTop: 8 }}>{money(item.price)}</Text>
      <Muted>
        {str(item.availability, str(item.stockStatus))} {item.pages ? `· ${item.pages} pages` : ""}
      </Muted>
      <Text style={{ marginTop: 12, lineHeight: 22 }}>{str(item.description)}</Text>
      {item.active === false || str(item.stockStatus) === "out_of_stock" ? (
        <Muted>This publication is not available in the published catalogue right now.</Muted>
      ) : (
        <Button
          label="Add to bag"
          onPress={() => cart.add({ id: str(item.id), title: str(item.title), price: Number(item.price) || 0 })}
        />
      )}
    </Screen>
  );
}
