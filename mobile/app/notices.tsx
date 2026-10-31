import { str } from "../src/api";
import { useFeed } from "../src/feed";
import { Card, Empty, Heading, Loading, Muted, PageHeader, Screen, SiteFooter } from "../src/ui";

export default function NoticesScreen() {
  const { feed, loading, refresh } = useFeed();
  const items = feed?.notices ?? [];
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <PageHeader kicker="Foundation desk" title="Notices" subtitle="Published notices from the Foundation website." />
      {items.map((item) => (
        <Card key={str(item.id)}>
          <Heading>{str(item.title)}</Heading>
          <Muted>
            {[str(item.date), str(item.category)].filter(Boolean).join(" · ")}
          </Muted>
          <Muted>{str(item.description)}</Muted>
        </Card>
      ))}
      {!items.length ? (
        <Empty icon="notifications-outline" label="No notices are in the published app feed yet." actionLabel="Refresh" onAction={() => void refresh()} />
      ) : null}
      <SiteFooter />
    </Screen>
  );
}
