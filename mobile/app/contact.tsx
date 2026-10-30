import { Linking, Text } from "react-native";
import { str } from "../src/api";
import { useFeed } from "../src/feed";
import { TicketForm } from "../src/ticket-form";
import { Button, Card, Loading, Muted, Screen } from "../src/ui";

export default function ContactScreen() {
  const { feed, loading } = useFeed();
  if (loading && !feed) return <Loading />;
  const site = feed?.site;
  return (
    <Screen>
      <Card>
        <Text style={{ fontWeight: "800", fontSize: 16 }}>{str(site?.name, "Vaidya Gogate Memorial Foundation")}</Text>
        <Muted>{str(site?.address)}</Muted>
        {str(site?.email) ? <Button kind="ghost" label={str(site?.email)} onPress={() => void Linking.openURL(`mailto:${str(site?.email)}`)} /> : null}
        {str(site?.phone) ? <Button kind="ghost" label={str(site?.phone)} onPress={() => void Linking.openURL(`tel:${str(site?.phone)}`)} /> : null}
      </Card>
      <TicketForm heading="Write to the Foundation" embedded />
    </Screen>
  );
}
