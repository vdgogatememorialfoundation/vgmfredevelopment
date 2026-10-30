import { Text } from "react-native";
import { str } from "../src/api";
import { useFeed } from "../src/feed";
import { Card, Empty, Loading, Muted, Screen, Title } from "../src/ui";

export default function AnnouncementsScreen() {
  const { feed, loading, refresh } = useFeed();
  const items = feed?.announcements ?? [];
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Title>Announcements</Title>
      {items.map((item) => (
        <Card key={str(item.id)}>
          <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(item.title)}</Text>
          <Muted>
            {str(item.date)} {str(item.category) ? `· ${str(item.category)}` : ""}
          </Muted>
          <Muted>{str(item.description)}</Muted>
        </Card>
      ))}
      {!items.length ? <Empty label="No announcements are in the published app feed yet." actionLabel="Refresh" onAction={() => void refresh()} /> : null}
    </Screen>
  );
}
