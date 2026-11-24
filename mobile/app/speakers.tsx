import { View } from "react-native";
import { router } from "expo-router";
import { mediaUrl, str, type Row } from "../src/api";
import { useFeed } from "../src/feed";
import { Body, Button, Card, Empty, Heading, Loading, Muted, PageHeader, Portrait, Screen } from "../src/ui";

type Speaker = { name: string; designation: string; photo: string; bio: string; topics: string[]; events: { slug: string; name: string }[] };

/** Speakers from the seminar and autism programmes in the live feed, as on the website's Speakers page. */
export default function SpeakersScreen() {
  const { feed, loading, refresh } = useFeed();
  if (loading && !feed) return <Loading />;
  const map = new Map<string, Speaker>();
  for (const event of (feed?.events ?? []) as Row[]) {
    for (const raw of (Array.isArray(event.speakers) ? event.speakers : []) as Row[]) {
      const name = str(raw.name).trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const current = map.get(key) ?? { name, designation: "", photo: "", bio: "", topics: [], events: [] };
      current.designation ||= str(raw.designation, str(raw.title));
      current.photo ||= str(raw.photo, str(raw.image));
      current.bio ||= str(raw.bio);
      if (str(raw.topic) && !current.topics.includes(str(raw.topic))) current.topics.push(str(raw.topic));
      if (!current.events.some((item) => item.slug === str(event.slug))) current.events.push({ slug: str(event.slug, str(event.id)), name: str(event.name) });
      map.set(key, current);
    }
  }
  const speakers = [...map.values()];
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <PageHeader kicker="Faculty" title="Speakers" />
      {speakers.map((speaker) => (
        <Card key={speaker.name}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <Portrait uri={mediaUrl(speaker.photo) || undefined} label={speaker.name} size={64} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Heading>{speaker.name}</Heading>
              {speaker.designation ? <Muted>{speaker.designation}</Muted> : null}
              {speaker.topics.length ? <Body>{speaker.topics.join(" · ")}</Body> : null}
              {speaker.bio ? <Muted>{speaker.bio}</Muted> : null}
              {speaker.events.map((event) => <Muted key={event.slug}>Event · {event.name}</Muted>)}
            </View>
          </View>
          {speaker.events[0] ? <Button kind="ghost" icon="calendar-outline" label="View event" onPress={() => router.push(`/event/${speaker.events[0].slug}` as never)} /> : null}
        </Card>
      ))}
      {!speakers.length ? <Empty icon="mic-outline" label="Speakers appear here once a programme lists them." actionLabel="Refresh" onAction={() => void refresh()} /> : null}
    </Screen>
  );
}
