import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { str, type Row } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Card, Empty, Loading, Muted, Screen, Title } from "../../src/ui";

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
        <Empty label="This policy is not in the published app feed." />
      </Screen>
    );
  }
  const sections = (Array.isArray(policy.sections) ? policy.sections : []) as Row[];
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Title>{str(policy.title, key)}</Title>
      <Muted>{str(policy.description)}</Muted>
      {sections.map((section, index) => (
        <Card key={str(section.title, String(index))}>
          <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(section.title)}</Text>
          <Muted>{str(section.body)}</Muted>
        </Card>
      ))}
    </Screen>
  );
}
