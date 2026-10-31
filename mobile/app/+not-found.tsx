import { router } from "expo-router";
import { Button, Empty, PageHeader, Screen } from "../src/ui";

export default function NotFound() {
  return (
    <Screen>
      <PageHeader kicker="VGMF" title="Screen not found" subtitle="That page is not part of the Foundation app." />
      <Empty icon="home-outline" label="Return to Home to continue browsing the published catalogue." />
      <Button icon="home-outline" label="Return home" onPress={() => router.replace("/")} />
    </Screen>
  );
}
