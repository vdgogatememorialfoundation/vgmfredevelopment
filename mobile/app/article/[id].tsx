import { useLocalSearchParams } from "expo-router";
import { findRow, mediaUrl, str } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Body, Cover, Empty, Loading, Muted, PageHeader, Screen } from "../../src/ui";

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
      <Muted>{str(item.excerpt)}</Muted>
      <Body>{str(item.content, str(item.excerpt))}</Body>
    </Screen>
  );
}
