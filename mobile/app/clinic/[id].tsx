import { useLocalSearchParams } from "expo-router";
import { Linking } from "react-native";
import { findRow, mediaUrl, str } from "../../src/api";
import { useFeed } from "../../src/feed";
import { Button, Cover, Empty, Loading, Muted, PageHeader, Screen } from "../../src/ui";

export default function ClinicDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, loading, refresh } = useFeed();
  const item = findRow(feed?.clinics, String(id ?? ""));
  if (loading && !feed) return <Loading />;
  if (!item) {
    return (
      <Screen>
        <Empty icon="medical-outline" label="This clinic is not in the published app feed." />
      </Screen>
    );
  }
  const phone = str(item.phone);
  const email = str(item.email);
  const map = str(item.mapLink);
  const appointment = str(item.appointmentUrl);
  const photo = mediaUrl((item.photos as { src?: string }[] | undefined)?.[0]?.src);
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <Cover uri={photo || undefined} height={200} />
      <PageHeader kicker={str(item.specialization, "Clinic")} title={str(item.name)} subtitle={[str(item.city), str(item.doctor)].filter(Boolean).join(" · ")} />
      <Muted>{str(item.about, str(item.address))}</Muted>
      {str(item.timings) ? <Muted>{str(item.timings)}</Muted> : null}
      {phone ? <Button icon="call-outline" label={`Call ${phone}`} onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
      {email ? <Button kind="ghost" icon="mail-outline" label={email} onPress={() => void Linking.openURL(`mailto:${email}`)} /> : null}
      {map ? <Button kind="ghost" icon="map-outline" label="Open map" onPress={() => void Linking.openURL(map)} /> : null}
      {appointment ? <Button kind="soft" icon="calendar-outline" label="Request appointment" onPress={() => void Linking.openURL(appointment)} /> : null}
    </Screen>
  );
}
