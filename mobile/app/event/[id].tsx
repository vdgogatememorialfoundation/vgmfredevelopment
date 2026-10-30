import { useLocalSearchParams } from "expo-router";
import { Linking } from "react-native";
import { findRow, formatDate, mediaUrl, money, str } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Button, Cover, Empty, Heading, Loading, Muted, Screen, StatusChip, Title } from "../../src/ui";

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, loading, refresh } = useFeed();
  const item = findRow(feed?.events, String(id ?? ""));
  if (loading && !feed) return <Loading />;
  if (!item) {
    return (
      <Screen>
        <Empty label="This event is not in the published app feed." />
      </Screen>
    );
  }
  const register = str(item.registrationUrl);
  const maps = str(item.mapsUrl);
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Cover uri={mediaUrl(item.bannerUrl) || undefined} height={200} />
      <StatusChip label={str(item.registrationStatus)} />
      <Title>{str(item.name)}</Title>
      <Muted>{[str(item.city), str(item.venue), formatDate(item.startDate)].filter(Boolean).join(" · ")}</Muted>
      <Muted>{[str(item.mode), str(item.eventType)].filter(Boolean).join(" · ")}</Muted>
      {Number(item.fee) ? <Heading>{money(item.fee)}</Heading> : null}
      <Muted>{str(item.description, str(item.shortDescription))}</Muted>
      {register ? <Button label="Register" onPress={() => void Linking.openURL(register)} /> : <Muted>Registration opens when a link is published.</Muted>}
      {maps ? <Button kind="ghost" label="Open map" onPress={() => void Linking.openURL(maps)} /> : null}
    </Screen>
  );
}
