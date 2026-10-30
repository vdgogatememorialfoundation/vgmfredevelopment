import { Text } from "react-native";
import { str } from "../src/api";
import { useFeed } from "../src/feed";
import { Card, Empty, Loading, Muted, Screen, Title } from "../src/ui";

export default function FaqScreen() {
  const { feed, loading, refresh } = useFeed();
  const items = feed?.faqs ?? [];
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Title>FAQ</Title>
      {items.map((item, index) => (
          <Card key={str(item.question, String(index))}>
          <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(item.question)}</Text>
          <Muted>{str(item.answer)}</Muted>
        </Card>
      ))}
      {!items.length ? <Empty label="FAQs appear here after Admin publishes the live site." /> : null}
    </Screen>
  );
}
