import { useLocalSearchParams } from "expo-router";
import { str, type Row } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Card, Empty, Heading, Loading, Muted, PageHeader, Screen } from "../../src/ui";

const ALIASES: Record<string, string> = {
  privacy: "privacy",
  terms: "terms",
  shipping: "shipping",
  "shipping-policy": "shipping",
  returns: "returns",
  "return-policy": "returns",
  refund: "refund",
  "refund-policy": "refund",
  cancellation: "cancellation",
  "cancellation-policy": "cancellation",
};

export default function PolicyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, loading, refresh } = useFeed();
  const key = ALIASES[String(id ?? "").toLowerCase()] ?? String(id ?? "");
  const policy = (feed?.policies?.[key] ?? null) as Row | null;
  if (loading && !feed) return <Loading />;
  if (!policy) {
    return (
      <Screen>
        <Empty icon="document-text-outline" label="This policy is not in the published app feed." />
      </Screen>
    );
  }
  const sections = (Array.isArray(policy.sections) ? policy.sections : []) as Row[];
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <PageHeader kicker="Policy" title={str(policy.title, key)} subtitle={str(policy.description)} />
      {sections.map((section, index) => (
        <Card key={str(section.title, String(index))}>
          <Heading>{str(section.title)}</Heading>
          <Muted>{str(section.body)}</Muted>
        </Card>
      ))}
    </Screen>
  );
}
