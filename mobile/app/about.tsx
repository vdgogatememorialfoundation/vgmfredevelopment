import { Text } from "react-native";
import { str, type Row } from "../src/api";
import { useFeed } from "../src/feed";
import { Card, Empty, Loading, Muted, Screen, Title } from "../src/ui";

export default function AboutScreen() {
  const { feed, loading, refresh } = useFeed();
  const about = (feed?.about ?? {}) as Row;
  if (loading && !feed) return <Loading />;
  const sections = (Array.isArray(about.sections) ? about.sections : []) as Row[];
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Title>{str(about.title, "About the Foundation")}</Title>
      <Muted>{str(about.intro)}</Muted>
      {sections.map((section, index) => (
        <Card key={str(section.id, String(index))}>
          <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(section.title)}</Text>
          <Muted>{str(section.body)}</Muted>
        </Card>
      ))}
      {!str(about.intro) && !sections.length ? <Empty label="About content appears here after Admin publishes the live site." /> : null}
    </Screen>
  );
}
