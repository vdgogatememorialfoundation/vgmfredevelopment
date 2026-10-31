import { Image, View } from "react-native";
import { mediaUrl, str } from "../src/api";
import { useFeed } from "../src/feed";
import { Empty, Loading, Muted, PageHeader, Screen } from "../src/ui";
import { useTheme } from "../src/theme";

export default function GalleryScreen() {
  const { feed, loading, refresh } = useFeed();
  const theme = useTheme();
  const items = feed?.gallery ?? [];
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <PageHeader kicker="Photographs" title="Gallery" subtitle="Published Foundation photographs" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {items.map((item) => (
          <View key={str(item.id)} style={{ width: "48%" }}>
            <Image
              source={{ uri: mediaUrl(item.src) }}
              accessibilityLabel={str(item.title, "Gallery photo")}
              style={{ width: "100%", aspectRatio: 1, borderRadius: theme.radius.md, backgroundColor: theme.colors.paper }}
              resizeMode="cover"
            />
            {str(item.title) ? <Muted>{str(item.title)}</Muted> : null}
          </View>
        ))}
      </View>
      {!items.length ? (
        <Empty icon="images-outline" label="No gallery photos are in the published app feed yet." actionLabel="Refresh" onAction={() => void refresh()} />
      ) : null}
    </Screen>
  );
}
