import { useLocalSearchParams } from "expo-router";
import { Linking, Text } from "react-native";
import { findRow, mediaUrl, money, str } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Button, Cover, Empty, Loading, Muted, Screen, Title } from "../../src/ui";

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
      <Cover uri={mediaUrl(item.bannerUrl) || undefined} height={180} />
      <Title>{str(item.name)}</Title>
      <Muted>
        {str(item.city)} {str(item.venue) ? `· ${str(item.venue)}` : ""} {str(item.startDate) ? `· ${str(item.startDate).slice(0, 10)}` : ""}
      </Muted>
      <Muted>
        {str(item.mode)} {str(item.eventType) ? `· ${str(item.eventType)}` : ""} {str(item.registrationStatus) ? `· ${str(item.registrationStatus)}` : ""}
      </Muted>
      {Number(item.fee) ? <Text style={{ fontWeight: "800", marginTop: 8 }}>{money(item.fee)}</Text> : null}
      <Text style={{ marginTop: 12, lineHeight: 22 }}>{str(item.description, str(item.shortDescription))}</Text>
      {register ? <Button label="Register" onPress={() => void Linking.openURL(register)} /> : <Muted>Registration opens on the Foundation seminar site when a link is published.</Muted>}
      {maps ? <Button kind="ghost" label="Open map" onPress={() => void Linking.openURL(maps)} /> : null}
    </Screen>
  );
}
