import { useLocalSearchParams } from "expo-router";
import { Linking, Text } from "react-native";
import { findRow, str } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Button, Empty, Loading, Muted, Screen, Title } from "../../src/ui";

export default function ClinicDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, loading, refresh } = useFeed();
  const item = findRow(feed?.clinics, String(id ?? ""));
  if (loading && !feed) return <Loading />;
  if (!item) {
    return (
      <Screen>
        <Empty label="This clinic is not in the published app feed." />
      </Screen>
    );
  }
  const phone = str(item.phone);
  const email = str(item.email);
  const map = str(item.mapLink);
  const appointment = str(item.appointmentUrl);
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Title>{str(item.name)}</Title>
      <Muted>
        {str(item.city)} {str(item.specialization) ? `· ${str(item.specialization)}` : ""}
      </Muted>
      <Muted>{str(item.doctor)}</Muted>
      <Text style={{ marginTop: 12, lineHeight: 22 }}>{str(item.about, str(item.address))}</Text>
      {str(item.timings) ? <Muted>{str(item.timings)}</Muted> : null}
      {phone ? <Button label={`Call ${phone}`} onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
      {email ? <Button kind="ghost" label={email} onPress={() => void Linking.openURL(`mailto:${email}`)} /> : null}
      {map ? <Button kind="ghost" label="Open map" onPress={() => void Linking.openURL(map)} /> : null}
      {appointment ? <Button kind="ghost" label="Request appointment" onPress={() => void Linking.openURL(appointment)} /> : null}
    </Screen>
  );
}
