import { useLocalSearchParams } from "expo-router";
import { Share, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { findRow, formatDate, getApiBase, mediaUrl, plainText, str } from "../../src/api";
import { useFeed } from "../../src/feed";
import { useTheme } from "../../src/theme";
import { Body, Button, Cover, Empty, Loading, Screen, SectionHeader, Tag } from "../../src/ui";
import { ArticleCard } from "../(tabs)/articles";

export default function ArticleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, loading, refresh } = useFeed();
  const theme = useTheme();
  const item = findRow(feed?.articles, String(id ?? ""));
  if (loading && !feed) return <Loading />;
  if (!item) {
    return (
      <Screen>
        <Empty icon="newspaper-outline" label="This article is not in the published app feed." />
      </Screen>
    );
  }
  const more = (feed?.articles ?? []).filter((row) => row !== item && (!str(item.category) || str(row.category) === str(item.category))).slice(0, 3);
  const share = () => {
    const link = `${getApiBase()}/articles/${str(item.slug, str(item.id))}`;
    void Share.share({ title: str(item.title), message: `${str(item.title)}\n${plainText(item.excerpt)}\n\nRead on Vaidya Gogate Memorial Foundation: ${link}` });
  };
  const meta = (icon: keyof typeof Ionicons.glyphMap, text: string) =>
    text ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Ionicons name={icon} size={14} color={theme.colors.muted} />
        <Text style={{ color: theme.colors.muted, fontSize: 12 }}>{text}</Text>
      </View>
    ) : null;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Cover uri={mediaUrl(item.coverImage) || undefined} height={200} />
      <View style={{ marginTop: 6, marginBottom: 10 }}>
        <Tag label={str(item.category, "Article")} tone="gold" />
      </View>
      <Text style={{ fontSize: 28, lineHeight: 35, fontWeight: "600", color: theme.colors.text, fontFamily: theme.fontFamily, letterSpacing: -0.3 }}>{str(item.title)}</Text>
      <View style={{ width: 44, height: 3, borderRadius: 2, backgroundColor: theme.colors.accent, marginVertical: 12 }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {meta("person-outline", str(item.author))}
        {meta("calendar-outline", formatDate(item.date))}
        {meta("time-outline", str(item.readingTime))}
      </View>
      <Button kind="soft" icon="share-social-outline" label="Share article" onPress={share} />
      <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 18 }} />
      <Body>{str(item.content, str(item.excerpt))}</Body>
      <Button kind="ghost" icon="share-social-outline" label="Share with a colleague" onPress={share} />
      {more.length ? (
        <>
          <View style={{ height: 18 }} />
          <SectionHeader title="More to read" />
          {more.map((row) => (
            <ArticleCard key={str(row.id)} item={row} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
