import { useLocalSearchParams } from "expo-router";
import { Share } from "react-native";
import { findRow, getApiBase, mediaUrl, str } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Body, Button, Cover, Empty, Loading, Muted, PageHeader, Screen } from "../../src/ui";

export default function ArticleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, loading, refresh } = useFeed();
  const item = findRow(feed?.articles, String(id ?? ""));
  if (loading && !feed) return <Loading />;
  if (!item) {
    return (
      <Screen>
        <Empty icon="newspaper-outline" label="This article is not in the published app feed." />
      </Screen>
    );
  }
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Cover uri={mediaUrl(item.coverImage) || undefined} />
      <PageHeader
        kicker="Article"
        title={str(item.title)}
        subtitle={[str(item.author), str(item.date).slice(0, 10), str(item.readingTime)].filter(Boolean).join(" · ")}
      />
      <Button
        kind="soft"
        icon="share-social-outline"
        label="Share article"
        onPress={() => {
          const link = `${getApiBase()}/articles/${str(item.slug, str(item.id))}`;
          void Share.share({ title: str(item.title), message: `${str(item.title)}\n${str(item.excerpt)}\n\nRead on Vaidya Gogate Memorial Foundation: ${link}` });
        }}
      />
      <Muted>{str(item.excerpt)}</Muted>
      <Body>{str(item.content, str(item.excerpt))}</Body>
    </Screen>
  );
}
