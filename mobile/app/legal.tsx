import { router } from "expo-router";
import { str, type Row } from "../src/api";
import { useFeed } from "../src/feed";
import { ListRow, Loading, PageHeader, Screen } from "../src/ui";

const POLICIES: { id: string; label: string }[] = [
  { id: "privacy", label: "Privacy policy" },
  { id: "terms", label: "Terms & conditions" },
  { id: "shipping", label: "Shipping policy" },
  { id: "returns", label: "Return policy" },
  { id: "refund", label: "Refund policy" },
  { id: "cancellation", label: "Cancellation policy" },
];

export default function LegalScreen() {
  const { feed, loading, refresh } = useFeed();
  if (loading && !feed) return <Loading />;
  const policies = (feed?.policies ?? {}) as Record<string, Row>;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <PageHeader kicker="Legal" title="Policies" subtitle="All policies of the Vaidya Gogate Memorial Foundation." />
      {POLICIES.map((item) => (
        <ListRow key={item.id} icon="document-text-outline" title={str(policies[item.id]?.title, item.label)} onPress={() => router.push(`/policy/${item.id}` as never)} />
      ))}
    </Screen>
  );
}
