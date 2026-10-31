import { useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { router } from "expo-router";
import { formatDate, getApiBase, isPastDate, isRegistrationClosed, mediaUrl, money, str } from "../../src/api";
import { TopBar } from "../../src/chrome";
import { useFeed } from "../../src/feed";
import { SITE } from "../../src/site-content";
import { Button, Card, Chip, Cover, DateBadge, Empty, Heading, Loading, Muted, PageHeader, Screen, SiteFooter, StatusChip } from "../../src/ui";

export default function EventsScreen() {
  const { feed, loading, refresh } = useFeed();
  const [scope, setScope] = useState<"upcoming" | "past" | "all">("all");
  const items = feed?.events ?? [];
  const upcoming = items.filter((item) => !isPastDate(item.endDate || item.startDate));
  const past = items.filter((item) => isPastDate(item.endDate || item.startDate));
  const shown = useMemo(() => (scope === "upcoming" ? upcoming : scope === "past" ? past : items), [items, past, scope, upcoming]);
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <TopBar />
      <PageHeader kicker="Academic assemblies" title="Events" subtitle="Conversations, scholarly symposia and accredited clinical workshops upholding authentic classical lineage." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <Chip label={`Upcoming (${upcoming.length})`} selected={scope === "upcoming"} onPress={() => setScope("upcoming")} />
        <Chip label={`Past (${past.length})`} selected={scope === "past"} onPress={() => setScope("past")} />
        <Chip label={`All events (${items.length})`} selected={scope === "all"} onPress={() => setScope("all")} />
      </View>
      {shown.map((item) => {
        const register = str(item.registrationUrl);
        const closed = isRegistrationClosed(item);
        return (
          <Card key={str(item.id)} onPress={() => router.push(`/event/${str(item.id)}`)}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <DateBadge label={formatDate(item.startDate)} />
              <StatusChip label={closed ? "Registration closed" : str(item.mode, str(item.registrationStatus))} />
            </View>
            <Cover uri={mediaUrl(item.bannerUrl) || undefined} height={148} />
            <Muted>{str(item.eventType, "Official assembly")}</Muted>
            <Heading>{str(item.name)}</Heading>
            <Muted>{[str(item.venue), str(item.city)].filter(Boolean).join(" · ")}</Muted>
            <Muted>{str(item.shortDescription)}</Muted>
            {Number(item.fee) ? <Muted>Delegation fee · {money(item.fee)}</Muted> : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button kind="ghost" label="View details" onPress={() => router.push(`/event/${str(item.id)}`)} />
              </View>
              <View style={{ flex: 1 }}>
                {closed ? (
                  <Button kind="ghost" label="Registration closed" disabled onPress={() => undefined} />
                ) : (
                  <Button label="Register now" onPress={() => (register ? void Linking.openURL(register) : void Linking.openURL(`${getApiBase()}${SITE.eventsUrl}`))} />
                )}
              </View>
            </View>
          </Card>
        );
      })}
      {!shown.length ? (
        <Empty
          icon="calendar-outline"
          label="No events are listed yet. Pull to refresh after the website is updated."
          actionLabel="Open website events"
          onAction={() => void Linking.openURL(`${getApiBase()}${SITE.eventsUrl}`)}
        />
      ) : null}
      <Card>
        <Heading>Certificate verification</Heading>
        <Muted>Attended a VGMF event? Verify your participation certificate with your registration ID.</Muted>
        <Button kind="ink" icon="ribbon-outline" label="Verify & authenticate" onPress={() => router.push("/certificates")} />
      </Card>
      <SiteFooter />
    </Screen>
  );
}
