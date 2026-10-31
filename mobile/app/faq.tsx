import { str } from "../src/api";
import { useFeed } from "../src/feed";
import { Card, Empty, Heading, Loading, Muted, PageHeader, Screen } from "../src/ui";

export default function FaqScreen() {
  const { feed, loading, refresh } = useFeed();
  const items = feed?.faqs ?? [];
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <PageHeader kicker="Help" title="FAQ" subtitle="Answers published by the Foundation" />
      {items.map((item, index) => (
        <Card key={str(item.question, String(index))}>
          <Heading>{str(item.question)}</Heading>
          <Muted>{str(item.answer)}</Muted>
        </Card>
      ))}
      {!items.length ? (
        <Empty icon="help-circle-outline" label="No FAQs are in the published app feed yet." actionLabel="Refresh" onAction={() => void refresh()} />
      ) : null}
    </Screen>
  );
}
