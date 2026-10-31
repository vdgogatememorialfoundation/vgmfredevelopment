import { useLocalSearchParams } from "expo-router";
import { Linking, View } from "react-native";
import { findRow, formatDate, isRegistrationClosed, mediaUrl, money, str } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Button, Cover, DateBadge, Empty, Heading, Loading, Muted, PageHeader, Screen, StatusChip } from "../../src/ui";

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, loading, refresh } = useFeed();
  const item = findRow(feed?.events, String(id ?? ""));
  if (loading && !feed) return <Loading />;
  if (!item) {
    return (
      <Screen>
        <Empty icon="calendar-outline" label="This event is not in the published app feed." />
      </Screen>
    );
  }
  const register = str(item.registrationUrl);
  const maps = str(item.mapsUrl);
  const closed = isRegistrationClosed(item);
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Cover uri={mediaUrl(item.bannerUrl) || undefined} height={210} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <DateBadge label={formatDate(item.startDate)} />
        <StatusChip label={closed ? "Closed" : str(item.registrationStatus)} />
      </View>
      <PageHeader kicker={str(item.eventType, "Event")} title={str(item.name)} subtitle={[str(item.city), str(item.venue)].filter(Boolean).join(" · ")} />
      <Muted>{[str(item.mode), str(item.eventType)].filter(Boolean).join(" · ")}</Muted>
      {Number(item.fee) ? <Heading>{money(item.fee)}</Heading> : null}
      <Muted>{str(item.description, str(item.shortDescription))}</Muted>
      {closed ? (
        <Button kind="ghost" icon="close-circle-outline" label="Registration closed" disabled onPress={() => undefined} />
      ) : register ? (
        <Button icon="ticket-outline" label="Register" onPress={() => void Linking.openURL(register)} />
      ) : (
        <Muted>Registration opens when a link is published.</Muted>
      )}
      {maps ? <Button kind="ghost" icon="map-outline" label="Open map" onPress={() => void Linking.openURL(maps)} /> : null}
    </Screen>
  );
}
