import { str } from "../src/api";
import { useFeed } from "../src/feed";
import { Card, Empty, Heading, Loading, Muted, PageHeader, Screen } from "../src/ui";

export default function AnnouncementsScreen() {
  const { feed, loading, refresh } = useFeed();
  const items = feed?.announcements ?? [];
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <PageHeader kicker="Updates" title="Announcements" subtitle="Published Foundation notices" />
      {items.map((item) => (
        <Card key={str(item.id)}>
          <Heading>{str(item.title)}</Heading>
          <Muted>
            {str(item.date)} {str(item.category) ? `· ${str(item.category)}` : ""}
          </Muted>
          <Muted>{str(item.description)}</Muted>
        </Card>
      ))}
      {!items.length ? (
        <Empty icon="megaphone-outline" label="No announcements are in the published app feed yet." actionLabel="Refresh" onAction={() => void refresh()} />
      ) : null}
    </Screen>
  );
}
