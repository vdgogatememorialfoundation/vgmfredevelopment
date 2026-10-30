import { router } from "expo-router";
import { Text } from "react-native";
import { mediaUrl, str, type Row } from "./api";
import { Card, Cover, Empty, Loading, Muted, Screen, Title } from "./ui";
import { useFeed } from "./feed";

export function CatalogList({
  title,
  empty,
  items,
  href,
  nameKey,
  imageKey,
  detail,
}: {
  title: string;
  empty: string;
  items: Row[];
  href: (id: string) => string;
  nameKey: string;
  imageKey?: string;
  detail?: (item: Row) => string;
}) {
  const { feed, loading, refresh } = useFeed();
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Title>{title}</Title>
      {items.map((item) => (
        <Card key={str(item.id, str(item.slug))} onPress={() => router.push(href(str(item.id, str(item.slug))) as never)}>
          {imageKey ? <Cover uri={mediaUrl(item[imageKey]) || undefined} height={140} /> : null}
          <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(item[nameKey], str(item.title))}</Text>
          {detail ? <Muted>{detail(item)}</Muted> : null}
        </Card>
      ))}
      {!items.length ? <Empty label={empty} /> : null}
    </Screen>
  );
}
