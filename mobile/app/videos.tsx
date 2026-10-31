import { Linking } from "react-native";
import { mediaUrl, str } from "../src/api";
import { useFeed } from "../src/feed";
import { Button, Card, Cover, Empty, Heading, Loading, Muted, PageHeader, Screen } from "../src/ui";

export default function VideosScreen() {
  const { feed, loading, refresh } = useFeed();
  const items = feed?.videos ?? [];
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <PageHeader kicker="Watch" title="Videos" subtitle="Talks and recorded Foundation sessions" />
      {items.map((item) => {
        const url = str(item.youtubeUrl, str(item.src));
        return (
          <Card key={str(item.id)}>
            <Cover uri={mediaUrl(item.poster) || undefined} height={170} />
            <Heading>{str(item.title)}</Heading>
            <Muted>{str(item.description)}</Muted>
            {url ? <Button kind="ghost" icon="play-outline" label="Watch" onPress={() => void Linking.openURL(url)} /> : null}
          </Card>
        );
      })}
      {!items.length ? (
        <Empty icon="play-circle-outline" label="No videos are in the published app feed yet." actionLabel="Refresh" onAction={() => void refresh()} />
      ) : null}
    </Screen>
  );
}
