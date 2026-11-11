import { useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { router } from "expo-router";
import { getApiBase, isPastDate, str } from "../../src/api";
import { TopBar } from "../../src/chrome";
import { EventCard } from "../../src/event-card";
import { useFeed } from "../../src/feed";
import { SITE } from "../../src/site-content";
import { Button, Card, Chip, Empty, Heading, Loading, Muted, PageHeader, Screen, SiteFooter } from "../../src/ui";

export default function EventsScreen() {
  const { feed, loading, refresh } = useFeed();
  const items = useMemo(() => feed?.events ?? [], [feed?.events]);
  const upcoming = useMemo(() => items.filter((item) => !isPastDate(item.endDate || item.startDate)), [items]);
  const past = useMemo(() => items.filter((item) => isPastDate(item.endDate || item.startDate)), [items]);
  const [scope, setScope] = useState<"upcoming" | "past" | "all">(upcoming.length ? "upcoming" : "all");
  const shown = scope === "upcoming" ? upcoming : scope === "past" ? past : items;
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <TopBar />
      <PageHeader kicker="Academic assemblies" title="Events" subtitle="Seminars, workshops and programmes of the Foundation. Register and track your application in the app." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <Chip label={`Upcoming (${upcoming.length})`} selected={scope === "upcoming"} onPress={() => setScope("upcoming")} />
        <Chip label={`Past (${past.length})`} selected={scope === "past"} onPress={() => setScope("past")} />
        <Chip label={`All (${items.length})`} selected={scope === "all"} onPress={() => setScope("all")} />
      </View>
      {shown.map((item) => (
        <EventCard key={str(item.id)} item={item} />
      ))}
      {!shown.length ? (
        <Empty
          icon="calendar-outline"
          label={scope === "upcoming" ? "No upcoming events right now. New events appear here as soon as they are announced." : "No events are listed yet."}
          actionLabel={scope === "upcoming" && past.length ? "See past events" : "Open website events"}
          onAction={() => (scope === "upcoming" && past.length ? setScope("past") : void Linking.openURL(`${getApiBase()}${SITE.eventsUrl}`))}
        />
      ) : null}
      <Card featured>
        <Heading>My registrations</Heading>
        <Muted>Follow every application step by step, the same tracker as on the website.</Muted>
        <Button kind="soft" icon="trail-sign-outline" label="Track my registrations" onPress={() => router.push("/account/registrations")} />
        <Button kind="ghost" icon="ribbon-outline" label="Verify a certificate" onPress={() => router.push("/certificates")} />
      </Card>
      <SiteFooter />
    </Screen>
  );
}
