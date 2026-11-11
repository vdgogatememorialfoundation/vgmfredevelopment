import { useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatDate, mediaUrl, plainText, str, type Row } from "../../src/api";
import { TopBar } from "../../src/chrome";
import { useFeed } from "../../src/feed";
import { useTheme } from "../../src/theme";
import { Chip, Empty, Loading, PageHeader, Screen, SearchBar, SiteFooter, Tag } from "../../src/ui";

export function ArticleCard({ item }: { item: Row }) {
  const theme = useTheme();
  const cover = mediaUrl(item.coverImage);
  const id = str(item.slug, str(item.id));
  return (
    <Pressable
      onPress={() => router.push(`/article/${id}`)}
      accessibilityRole="button"
      accessibilityLabel={str(item.title)}
      style={({ pressed }) => [
        {
          backgroundColor: theme.colors.paper,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: 14,
          overflow: "hidden",
          shadowColor: "#3B2A14",
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {cover ? <Image source={{ uri: cover }} accessibilityLabel={str(item.title)} style={{ width: "100%", height: 160 }} resizeMode="cover" /> : <View style={{ height: 4, backgroundColor: theme.colors.accent }} />}
      <View style={{ padding: 16, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Tag label={str(item.category, "Article")} tone="gold" />
          {str(item.readingTime) ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="time-outline" size={13} color={theme.colors.muted} />
              <Text style={{ color: theme.colors.muted, fontSize: 12 }}>{str(item.readingTime)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 18, lineHeight: 24, fontFamily: theme.fontFamily }}>{str(item.title)}</Text>
        <Text numberOfLines={2} style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 20 }}>{plainText(item.excerpt)}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ color: theme.colors.muted, fontSize: 12 }}>{[str(item.author), formatDate(item.date)].filter(Boolean).join(" · ")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: theme.colors.primary, fontWeight: "800", fontSize: 12 }}>Read</Text>
            <Ionicons name="arrow-forward" size={13} color={theme.colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function ArticlesScreen() {
  const { feed, loading, refresh } = useFeed();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const items = useMemo(() => feed?.articles ?? [], [feed?.articles]);
  const categories = useMemo(() => Array.from(new Set(items.map((item) => str(item.category)).filter(Boolean))), [items]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category && str(item.category) !== category) return false;
      if (!q) return true;
      return [item.title, item.excerpt, item.author, item.category].some((value) => str(value).toLowerCase().includes(q));
    });
  }, [items, query, category]);
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <TopBar />
      <PageHeader kicker="Library" title="Articles" subtitle={`${items.length} articles by the Foundation for doctors, students and readers.`} />
      <SearchBar value={query} onChange={setQuery} placeholder="Search articles" />
      {categories.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <Chip label="All" selected={!category} onPress={() => setCategory("")} />
          {categories.map((name) => (
            <Chip key={name} label={name} selected={category === name} onPress={() => setCategory(name)} />
          ))}
        </View>
      ) : null}
      {shown.map((item) => (
        <ArticleCard key={str(item.id, str(item.slug))} item={item} />
      ))}
      {!shown.length ? <Empty icon="newspaper-outline" label={items.length ? "No articles match that search." : "No articles are published yet. Pull to refresh."} actionLabel="Refresh" onAction={() => void refresh()} /> : null}
      <SiteFooter />
    </Screen>
  );
}
