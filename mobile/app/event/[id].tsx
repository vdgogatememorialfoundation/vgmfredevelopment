import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Linking, Share, Text, View } from "react-native";
import { findRow, formatDate, getApiBase, isRegistrationClosed, mediaUrl, money, str } from "../../src/api";
import { dateParts } from "../../src/event-card";
import { useFeed } from "../../src/feed";
import { PartnerRegister } from "../../src/partner-register";
import { useTheme } from "../../src/theme";
import { Body, Button, Cover, Empty, InfoRow, Loading, Panel, Portrait, Screen, Tag } from "../../src/ui";

type Window = { label?: string; start?: string; end?: string } | null | undefined;
type Speaker = { id?: string; name?: string; designation?: string; title?: string; topic?: string; photo?: string; image?: string };
type Slot = { id?: string; time?: string; title?: string; topic?: string; label?: string; speaker?: string };

function windowOpen(window: Window, now = Date.now()) {
  if (!window?.label) return false;
  const start = Date.parse(String(window.start ?? ""));
  const end = Date.parse(String(window.end ?? ""));
  if (Number.isFinite(start) && start > now) return false;
  if (Number.isFinite(end) && end <= now) return false;
  return true;
}

function openPhase(item: Record<string, unknown>): "pre" | "main" | null {
  if (windowOpen(item.preRegistration as Window)) return "pre";
  if (windowOpen(item.mainRegistration as Window)) return "main";
  return null;
}

function timeOf(value: unknown) {
  const date = new Date(str(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { feed, loading, refresh } = useFeed();
  const theme = useTheme();
  const [terms, setTerms] = useState(false);
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
  const place = [str(item.venue), str(item.city)].filter(Boolean).join(", ");
  const rawMaps = str(item.mapsUrl);
  const embedQuery = /\/maps\/embed\//.test(rawMaps) ? decodeURIComponent((rawMaps.match(/[?&]q=([^&]+)/) ?? [])[1] ?? "") : "";
  const maps = rawMaps && !/\/maps\/embed\//.test(rawMaps)
    ? rawMaps
    : embedQuery || place
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(embedQuery || place)}`
      : "";
  const closed = isRegistrationClosed(item);
  const source = str(item.source);
  const portalId = source === "seminar" || source === "autism" ? Number(str(item.id).split("-").pop()) : 0;
  const phase = openPhase(item);
  const when = dateParts(item.startDate);
  const speakers = (Array.isArray(item.speakers) ? item.speakers : []) as Speaker[];
  const schedule = (Array.isArray(item.schedule) ? item.schedule : []) as Slot[];
  const sameDay = formatDate(item.startDate) === formatDate(item.endDate) || !str(item.endDate);
  const dates = sameDay ? formatDate(item.startDate) : `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`;
  const times = [timeOf(item.startDate), timeOf(item.endDate)].filter(Boolean).join(" – ");
  const regWindow = [formatDate(item.registrationStart), formatDate(item.registrationEnd)].filter(Boolean).join(" – ");
  const termsText = str(item.termsConditions);

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      {mediaUrl(item.bannerUrl) ? (
        <Cover uri={mediaUrl(item.bannerUrl)} height={210} />
      ) : (
        <View style={{ backgroundColor: theme.colors.secondary, borderRadius: 10, padding: 18, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 16, overflow: "hidden" }}>
          <View style={{ position: "absolute", right: -30, top: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.07)" }} />
          <View style={{ width: 70, borderRadius: 10, backgroundColor: theme.colors.paper, alignItems: "center", paddingVertical: 10 }}>
            <Text style={{ color: theme.colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>{when.month}</Text>
            <Text style={{ color: theme.colors.text, fontSize: 28, fontWeight: "800", lineHeight: 32 }}>{when.day}</Text>
            <Text style={{ color: theme.colors.muted, fontSize: 10, fontWeight: "700" }}>{when.year}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" }}>{str(item.eventType, "Event")}</Text>
            <Text style={{ color: theme.colors.onPrimary, fontSize: 15, fontWeight: "700", marginTop: 4 }}>{str(item.mode, "Foundation programme")}</Text>
          </View>
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        <Tag label={str(item.eventType, "Event")} tone="ink" />
        <Tag label={closed ? "Registration closed" : "Registration open"} tone={closed ? "red" : "green"} />
      </View>
      <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: "600", color: theme.colors.text, fontFamily: theme.fontFamily }}>{str(item.name)}</Text>
      <View style={{ width: 44, height: 3, borderRadius: 2, backgroundColor: theme.colors.accent, marginVertical: 12 }} />
      {str(item.description, str(item.shortDescription)) ? <Body>{str(item.description, str(item.shortDescription))}</Body> : null}
      <View style={{ height: 14 }} />

      <Panel title="Event details">
        <InfoRow icon="calendar-outline" label="Date" value={dates} />
        <InfoRow icon="time-outline" label="Time" value={times} />
        <InfoRow icon="location-outline" label="Venue" value={[str(item.venue), str(item.city)].filter(Boolean).join(", ")} />
        <InfoRow icon="desktop-outline" label="Mode" value={str(item.mode)} />
        <InfoRow icon="wallet-outline" label="Delegation fee" value={Number(item.fee) ? money(item.fee) : ""} />
        <InfoRow icon="people-outline" label="Seats" value={Number(item.capacity) ? String(item.capacity) : ""} />
        <InfoRow icon="hourglass-outline" label="Registration" value={regWindow} />
      </Panel>

      {portalId > 0 && phase ? (
        <PartnerRegister portal={source} seminarId={portalId} phase={phase} portalUrl={register || undefined} />
      ) : closed ? (
        <Button kind="ghost" icon="close-circle-outline" label="Registration closed" disabled onPress={() => undefined} />
      ) : register ? (
        <Button icon="ticket-outline" label="Register" onPress={() => void Linking.openURL(register)} />
      ) : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {maps ? (
          <View style={{ flex: 1 }}>
            <Button kind="ghost" icon="navigate-outline" label="Directions" onPress={() => void Linking.openURL(maps)} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button
            kind="ghost"
            icon="share-social-outline"
            label="Share"
            onPress={() => void Share.share({ message: `${str(item.name)} · ${dates}\n${register || `${getApiBase()}/events`}` })}
          />
        </View>
      </View>
      <View style={{ height: 14 }} />

      {speakers.length ? (
        <Panel title="Speakers">
          {speakers.map((speaker, index) => (
            <View key={str(speaker.id, String(index))} style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10, borderBottomWidth: index === speakers.length - 1 ? 0 : 1, borderBottomColor: theme.colors.border }}>
              <Portrait uri={mediaUrl(speaker.photo || speaker.image) || undefined} label={str(speaker.name)} size={48} fallback={require("../../assets/icon.png")} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{str(speaker.name)}</Text>
                <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2 }}>{[str(speaker.designation, str(speaker.title)), str(speaker.topic)].filter(Boolean).join(" · ")}</Text>
              </View>
            </View>
          ))}
        </Panel>
      ) : null}

      {schedule.length ? (
        <Panel title="Schedule">
          {schedule.map((slot, index) => (
            <View key={str(slot.id, String(index))} style={{ flexDirection: "row", gap: 12, paddingVertical: 10 }}>
              <View style={{ alignItems: "center", width: 14 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary, marginTop: 4 }} />
                {index < schedule.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: theme.colors.border, marginTop: 4 }} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.primary, fontWeight: "800", fontSize: 12 }}>{[formatDate(slot.time), timeOf(slot.time)].filter(Boolean).join(" · ")}</Text>
                <Text style={{ color: theme.colors.text, fontWeight: "700", marginTop: 2 }}>{str(slot.title, str(slot.topic, str(slot.label)))}</Text>
                {str(slot.speaker) ? <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2 }}>{str(slot.speaker)}</Text> : null}
              </View>
            </View>
          ))}
        </Panel>
      ) : null}

      {termsText ? (
        <Panel title="Terms & conditions">
          <Text numberOfLines={terms ? undefined : 4} style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 20, paddingVertical: 6 }}>
            {termsText}
          </Text>
          <Text onPress={() => setTerms(!terms)} style={{ color: theme.colors.primary, fontWeight: "800", fontSize: 13, paddingBottom: 12 }}>
            {terms ? "Show less" : "Read all terms"}
          </Text>
        </Panel>
      ) : null}
    </Screen>
  );
}
