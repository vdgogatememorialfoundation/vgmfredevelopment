import { Linking } from "react-native";
import { str } from "../src/api";
import { useFeed } from "../src/feed";
import { TicketForm } from "../src/ticket-form";
import { Button, Card, Loading, Muted, PageHeader, Screen } from "../src/ui";

export default function ContactScreen() {
  const { feed, loading } = useFeed();
  if (loading && !feed) return <Loading />;
  const site = feed?.site;
  return (
    <Screen>
      <PageHeader kicker="Reach us" title="Contact" subtitle={str(site?.name, "Vaidya Gogate Memorial Foundation")} />
      <Card featured>
        <Muted>{str(site?.address)}</Muted>
        {str(site?.email) ? <Button kind="ghost" icon="mail-outline" label={str(site?.email)} onPress={() => void Linking.openURL(`mailto:${str(site?.email)}`)} /> : null}
        {str(site?.phone) ? <Button kind="ghost" icon="call-outline" label={str(site?.phone)} onPress={() => void Linking.openURL(`tel:${str(site?.phone)}`)} /> : null}
      </Card>
      <TicketForm heading="Write to the Foundation" embedded />
    </Screen>
  );
}
