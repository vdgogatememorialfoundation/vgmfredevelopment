import { useLocalSearchParams } from "expo-router";
import { str, type Row } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Body, Card, Empty, Loading, PageHeader, Screen } from "../../src/ui";

export default function CustomPageScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { feed, loading, refresh } = useFeed();
  const page = ((feed?.pages ?? []) as Row[]).find((row) => str(row.slug) === String(slug ?? "") && row.enabled !== false) ?? null;
  if (loading && !feed) return <Loading />;
  if (!page) {
    return (
      <Screen refreshing={loading} onRefresh={refresh}>
        <Empty icon="document-text-outline" label="This page is not published right now." />
      </Screen>
    );
  }
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <PageHeader kicker="Foundation page" title={str(page.title)} subtitle={str(page.excerpt)} />
      {str(page.body) ? (
        <Card>
          <Body>{str(page.body)}</Body>
        </Card>
      ) : null}
    </Screen>
  );
}
