import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { findRow, mediaUrl, str } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Cover, Empty, Loading, Muted, Screen, Title } from "../../src/ui";

export default function ArticleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, loading, refresh } = useFeed();
  const item = findRow(feed?.articles, String(id ?? ""));
  if (loading && !feed) return <Loading />;
  if (!item) {
    return (
      <Screen>
        <Empty label="This article is not in the published app feed." />
      </Screen>
    );
  }
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Cover uri={mediaUrl(item.coverImage) || undefined} />
      <Title>{str(item.title)}</Title>
      <Muted>
        {str(item.author)} {str(item.date) ? `· ${str(item.date).slice(0, 10)}` : ""} {str(item.readingTime) ? `· ${str(item.readingTime)}` : ""}
      </Muted>
      <Text style={{ marginTop: 12, lineHeight: 22 }}>{str(item.content, str(item.excerpt))}</Text>
    </Screen>
  );
}
