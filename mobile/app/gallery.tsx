import { Text } from "react-native";
import { mediaUrl, str } from "../src/api";
import { useFeed } from "../src/feed";
import { Card, Cover, Empty, Loading, Muted, Screen, Title } from "../src/ui";

export default function GalleryScreen() {
  const { feed, loading, refresh } = useFeed();
  const items = feed?.gallery ?? [];
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Title>Gallery</Title>
      {items.map((item) => (
        <Card key={str(item.id)}>
          <Cover uri={mediaUrl(item.src) || undefined} height={200} />
          <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(item.title)}</Text>
          <Muted>{str(item.caption, str(item.category))}</Muted>
        </Card>
      ))}
      {!items.length ? <Empty label="Gallery photos appear here after Admin publishes the live site." /> : null}
    </Screen>
  );
}
