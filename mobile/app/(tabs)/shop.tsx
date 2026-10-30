import { router } from "expo-router";
import { Text, View } from "react-native";
import { mediaUrl, money, str } from "../../src/api";
import { useCart } from "../../src/cart";
import { useFeed } from "../../src/feed";
import { Button, Card, Cover, Empty, Loading, Muted, Screen, Title } from "../../src/ui";
import { colors } from "../../src/theme";

export default function ShopScreen() {
  const { feed, loading, refresh } = useFeed();
  const cart = useCart();
  const items = feed?.books ?? [];
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Title>Publications</Title>
        <Button label={`Bag ${cart.count}`} kind="ghost" onPress={() => router.push("/cart")} />
      </View>
      {items.map((item) => (
        <Card key={str(item.id)} onPress={() => router.push(`/book/${str(item.id)}`)}>
          <Cover uri={mediaUrl(item.coverImage) || undefined} height={140} />
          <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(item.title)}</Text>
          <Muted>{str(item.author)}</Muted>
          <Text style={{ color: colors.burgundy, fontWeight: "800", marginTop: 6 }}>{money(item.price)}</Text>
        </Card>
      ))}
      {!items.length ? <Empty label="Books appear here after Admin publishes the live site." /> : null}
    </Screen>
  );
}
