import { useMemo, useState } from "react";
import { router } from "expo-router";
import { mediaUrl, str } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Card, Cover, Empty, Heading, Loading, Muted, Screen, SearchBar, SectionHeader } from "../../src/ui";
import { useTheme } from "../../src/theme";

export default function ClinicsScreen() {
  const { feed, loading, refresh } = useFeed();
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const items = feed?.clinics ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) =>
      !q || [item.name, item.city, item.specialization, item.doctor, item.address].some((value) => str(value).toLowerCase().includes(q))
    );
  }, [items, query]);
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <SectionHeader title={theme.labels.clinics} subtitle="Foundation clinics from the published feed" />
      <SearchBar value={query} onChange={setQuery} placeholder="Search clinics" />
      {filtered.map((item) => (
        <Card key={str(item.id)} onPress={() => router.push(`/clinic/${str(item.id)}`)}>
          <Cover uri={mediaUrl((item.photos as { src?: string }[] | undefined)?.[0]?.src) || undefined} height={120} />
          <Heading>{str(item.name)}</Heading>
          <Muted>{[str(item.city), str(item.specialization)].filter(Boolean).join(" · ")}</Muted>
          {str(item.address) ? <Muted>{str(item.address)}</Muted> : null}
        </Card>
      ))}
      {!filtered.length ? (
        <Empty
          label={items.length ? "No published clinics match that search." : "No clinics are in the published app feed yet. Pull to refresh after Admin publishes."}
          actionLabel="Refresh"
          onAction={() => void refresh()}
        />
      ) : null}
    </Screen>
  );
}
