import { useMemo, useState } from "react";
import { router } from "expo-router";
import { formatDate, isPastDate, mediaUrl, str } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Card, Cover, Empty, Heading, Loading, Muted, Screen, SearchBar, SectionHeader, StatusChip } from "../../src/ui";
import { useTheme } from "../../src/theme";

export default function EventsScreen() {
  const { feed, loading, refresh, error } = useFeed();
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const items = feed?.events ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) =>
      !q || [item.name, item.city, item.venue, item.eventType, item.shortDescription].some((value) => str(value).toLowerCase().includes(q))
    );
  }, [items, query]);
  const upcoming = filtered.filter((item) => !isPastDate(item.endDate || item.startDate));
  const past = filtered.filter((item) => isPastDate(item.endDate || item.startDate));
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <SectionHeader title={theme.labels.events} subtitle={error ? undefined : "Published Foundation events"} />
      <SearchBar value={query} onChange={setQuery} placeholder="Search events" />
      {upcoming.length ? <SectionHeader title="Upcoming" /> : null}
      {upcoming.map((item) => (
        <Card key={str(item.id)} onPress={() => router.push(`/event/${str(item.id)}`)}>
          <Cover uri={mediaUrl(item.bannerUrl) || undefined} height={140} />
          <Heading>{str(item.name)}</Heading>
          <Muted>{[str(item.city), str(item.venue), formatDate(item.startDate)].filter(Boolean).join(" · ")}</Muted>
          <StatusChip label={str(item.registrationStatus, str(item.mode))} />
        </Card>
      ))}
      {past.length ? <SectionHeader title="Past" /> : null}
      {past.map((item) => (
        <Card key={str(item.id)} onPress={() => router.push(`/event/${str(item.id)}`)}>
          <Heading>{str(item.name)}</Heading>
          <Muted>{[str(item.city), formatDate(item.startDate)].filter(Boolean).join(" · ")}</Muted>
        </Card>
      ))}
      {!filtered.length ? (
        <Empty
          label={items.length ? "No published events match that search." : "No published events are in the app feed yet. Pull to refresh after Admin publishes."}
          actionLabel="Refresh"
          onAction={() => void refresh()}
        />
      ) : null}
    </Screen>
  );
}
