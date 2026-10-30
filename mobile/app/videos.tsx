import { Linking, Text } from "react-native";
import { mediaUrl, str } from "../src/api";
import { useFeed } from "../src/feed";
import { Button, Card, Cover, Empty, Loading, Muted, Screen, Title } from "../src/ui";

export default function VideosScreen() {
  const { feed, loading, refresh } = useFeed();
  const items = feed?.videos ?? [];
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Title>Videos</Title>
      {items.map((item) => {
        const url = str(item.youtubeUrl, str(item.src));
        return (
          <Card key={str(item.id)}>
            <Cover uri={mediaUrl(item.poster) || undefined} height={160} />
            <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(item.title)}</Text>
            <Muted>{str(item.description)}</Muted>
            {url ? <Button kind="ghost" label="Watch" onPress={() => void Linking.openURL(url)} /> : null}
          </Card>
        );
      })}
      {!items.length ? <Empty label="No videos are in the published app feed yet." actionLabel="Refresh" onAction={() => void refresh()} /> : null}
    </Screen>
  );
}
