import { useLocalSearchParams, router } from "expo-router";
import { useMemo, useState } from "react";
import { formatDate, mediaUrl, money, str } from "../src/api";
import { useFeed } from "../src/feed";
import { Card, Cover, Empty, Heading, Loading, Muted, Screen, SearchBar, SectionHeader } from "../src/ui";

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { feed, loading, refresh } = useFeed();
  const [query, setQuery] = useState(String(params.q ?? ""));
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!feed || !q) return { books: [], events: [], clinics: [], articles: [] };
    const match = (...values: unknown[]) => values.some((value) => str(value).toLowerCase().includes(q));
    return {
      books: feed.books.filter((item) => match(item.title, item.author, item.description)),
      events: feed.events.filter((item) => match(item.name, item.city, item.shortDescription)),
      clinics: feed.clinics.filter((item) => match(item.name, item.city, item.specialization)),
      articles: feed.articles.filter((item) => match(item.title, item.excerpt, item.author)),
    };
  }, [feed, q]);
  const total = results.books.length + results.events.length + results.clinics.length + results.articles.length;
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <SearchBar value={query} onChange={setQuery} placeholder="Search the published catalogue" />
      {!q ? <Muted>Search publications, events, clinics and articles from the live app feed.</Muted> : null}
      {q && !total ? <Empty label="Nothing in the published feed matches that search." /> : null}
      {results.books.length ? <SectionHeader title="Publications" /> : null}
      {results.books.map((item) => (
        <Card key={str(item.id)} onPress={() => router.push(`/book/${str(item.id)}`)}>
          <Cover uri={mediaUrl(item.coverImage) || undefined} height={80} />
          <Heading>{str(item.title)}</Heading>
          <Muted>{money(item.price)}</Muted>
        </Card>
      ))}
      {results.events.length ? <SectionHeader title="Events" /> : null}
      {results.events.map((item) => (
        <Card key={str(item.id)} onPress={() => router.push(`/event/${str(item.id)}`)}>
          <Heading>{str(item.name)}</Heading>
          <Muted>{[str(item.city), formatDate(item.startDate)].filter(Boolean).join(" · ")}</Muted>
        </Card>
      ))}
      {results.clinics.length ? <SectionHeader title="Clinics" /> : null}
      {results.clinics.map((item) => (
        <Card key={str(item.id)} onPress={() => router.push(`/clinic/${str(item.id)}`)}>
          <Heading>{str(item.name)}</Heading>
          <Muted>{[str(item.city), str(item.specialization)].filter(Boolean).join(" · ")}</Muted>
        </Card>
      ))}
      {results.articles.length ? <SectionHeader title="Articles" /> : null}
      {results.articles.map((item) => (
        <Card key={str(item.id)} onPress={() => router.push(`/article/${str(item.id)}`)}>
          <Heading>{str(item.title)}</Heading>
          <Muted>{str(item.author)}</Muted>
        </Card>
      ))}
    </Screen>
  );
}
