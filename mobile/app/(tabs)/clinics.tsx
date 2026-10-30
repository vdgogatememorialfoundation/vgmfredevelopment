import { router } from "expo-router";
import { Text } from "react-native";
import { str } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Card, Empty, Loading, Muted, Screen, Title } from "../../src/ui";

export default function ClinicsScreen() {
  const { feed, loading, refresh } = useFeed();
  const items = feed?.clinics ?? [];
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Title>Clinics</Title>
      {items.map((item) => (
        <Card key={str(item.id)} onPress={() => router.push(`/clinic/${str(item.id)}`)}>
          <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(item.name)}</Text>
          <Muted>
            {str(item.city)} {str(item.specialization) ? `· ${str(item.specialization)}` : ""}
          </Muted>
        </Card>
      ))}
      {!items.length ? <Empty label="Clinics appear here after Admin publishes the live site." /> : null}
    </Screen>
  );
}
