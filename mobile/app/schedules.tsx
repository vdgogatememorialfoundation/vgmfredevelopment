import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { str, type Row } from "../src/api";
import { useFeed } from "../src/feed";
import { Body, Button, Card, Chip, Empty, Heading, Loading, Muted, PageHeader, Screen } from "../src/ui";

function whenLabel(value: unknown) {
  const text = str(value);
  const date = new Date(text);
  if (!text || Number.isNaN(date.getTime())) return text;
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Session times for seminar and autism programmes, as on the website's Schedules page. */
export default function SchedulesScreen() {
  const { feed, loading, refresh } = useFeed();
  const [picked, setPicked] = useState("");
  if (loading && !feed) return <Loading />;
  const events = ((feed?.events ?? []) as Row[]).filter((event) => Array.isArray(event.schedule) && event.schedule.length);
  const selected = events.find((event) => str(event.id) === picked) ?? events[0];
  const slots = (selected && Array.isArray(selected.schedule) ? selected.schedule : []) as Row[];
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <PageHeader kicker="Programmes" title="Event schedules" />
      {events.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {events.map((event) => (
            <Chip key={str(event.id)} label={str(event.name)} selected={event === selected} onPress={() => setPicked(str(event.id))} />
          ))}
        </View>
      ) : null}
      {selected ? (
        <Card>
          <Heading>{str(selected.name)}</Heading>
          {str(selected.venue) ? <Muted>{str(selected.venue)}</Muted> : null}
          {slots.map((slot, index) => (
            <View key={str(slot.id, String(index))} style={{ marginTop: 10 }}>
              <Muted>Starts {whenLabel(slot.time)}</Muted>
              {str(slot.endTime) ? <Muted>Ends {whenLabel(slot.endTime)}</Muted> : null}
              <Body>{str(slot.title, str(slot.topic, str(slot.label)))}</Body>
              {str(slot.speaker) ? <Muted>{str(slot.speaker)}</Muted> : null}
            </View>
          ))}
          <Button kind="ghost" icon="calendar-outline" label="View event" onPress={() => router.push(`/event/${str(selected.slug, str(selected.id))}` as never)} />
        </Card>
      ) : (
        <Empty icon="calendar-number-outline" label="Schedules appear here once a programme publishes its sessions." actionLabel="Refresh" onAction={() => void refresh()} />
      )}
    </Screen>
  );
}
