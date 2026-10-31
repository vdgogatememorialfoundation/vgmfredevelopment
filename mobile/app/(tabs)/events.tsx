import { useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { formatDate, isPastDate, mediaUrl, str } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Card, Chip, Cover, DateBadge, Empty, Heading, Loading, Muted, PageHeader, Screen, SearchBar, StatusChip } from "../../src/ui";
import { useTheme } from "../../src/theme";

export default function EventsScreen() {
  const { feed, loading, refresh, error } = useFeed();
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"upcoming" | "past" | "all">("upcoming");
  const items = feed?.events ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (item) => !q || [item.name, item.city, item.venue, item.eventType, item.shortDescription].some((value) => str(value).toLowerCase().includes(q))
    );
  }, [items, query]);
  const upcoming = filtered.filter((item) => !isPastDate(item.endDate || item.startDate));
  const past = filtered.filter((item) => isPastDate(item.endDate || item.startDate));
  const shown = scope === "upcoming" ? upcoming : scope === "past" ? past : filtered;
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <PageHeader kicker="Calendar" title={theme.labels.events} subtitle={error ? undefined : "Published Foundation events"} />
      <SearchBar value={query} onChange={setQuery} placeholder="Search events" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <Chip label={`Upcoming ${upcoming.length}`} selected={scope === "upcoming"} onPress={() => setScope("upcoming")} />
        <Chip label={`Past ${past.length}`} selected={scope === "past"} onPress={() => setScope("past")} />
        <Chip label={`All ${filtered.length}`} selected={scope === "all"} onPress={() => setScope("all")} />
      </View>
      {shown.map((item) => (
        <Card key={str(item.id)} onPress={() => router.push(`/event/${str(item.id)}`)}>
          {scope !== "past" ? <Cover uri={mediaUrl(item.bannerUrl) || undefined} height={148} /> : null}
          <DateBadge label={formatDate(item.startDate)} />
          <View style={{ marginTop: 8 }}>
            <Heading>{str(item.name)}</Heading>
          </View>
          <Muted>{[str(item.city), str(item.venue)].filter(Boolean).join(" · ")}</Muted>
          <StatusChip label={str(item.registrationStatus, str(item.mode))} />
        </Card>
      ))}
      {!shown.length ? (
        <Empty
          icon="calendar-outline"
          label={items.length ? "No published events match that search." : "No published events are in the app feed yet. Pull to refresh after Admin publishes."}
          actionLabel="Refresh"
          onAction={() => void refresh()}
        />
      ) : null}
    </Screen>
  );
}
