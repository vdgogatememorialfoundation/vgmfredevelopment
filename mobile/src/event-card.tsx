import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { isRegistrationClosed, mediaUrl, money, str, type Row } from "./api";
import { useTheme } from "./theme";
import { Cover, Tag } from "./ui";

export function dateParts(value: unknown) {
  const date = new Date(str(value));
  if (Number.isNaN(date.getTime())) return { day: "", month: "", year: "" };
  return {
    day: String(date.getDate()),
    month: date.toLocaleDateString("en-IN", { month: "short" }).toUpperCase(),
    year: String(date.getFullYear()),
  };
}

export function EventCard({ item }: { item: Row }) {
  const theme = useTheme();
  const closed = isRegistrationClosed(item);
  const when = dateParts(item.startDate);
  const place = [str(item.venue), str(item.city)].filter(Boolean).join(", ");
  return (
    <Pressable
      onPress={() => router.push(`/event/${str(item.id)}`)}
      accessibilityRole="button"
      accessibilityLabel={str(item.name)}
      style={({ pressed }) => [
        {
          backgroundColor: theme.colors.paper,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: 14,
          overflow: "hidden",
          shadowColor: "#3B2A14",
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {mediaUrl(item.bannerUrl) ? <Cover uri={mediaUrl(item.bannerUrl)} height={150} /> : null}
      <View style={{ flexDirection: "row", gap: 14, padding: 16 }}>
        <View style={{ width: 62, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: "center", paddingVertical: 10 }}>
          <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>{when.month}</Text>
          <Text style={{ color: theme.colors.onPrimary, fontSize: 24, fontWeight: "800", lineHeight: 28 }}>{when.day}</Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "700" }}>{when.year}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Tag label={str(item.eventType, "Event")} tone="ink" />
            <Tag label={closed ? "Registration closed" : "Registration open"} tone={closed ? "red" : "green"} />
          </View>
          <Text style={{ color: theme.colors.text, fontWeight: "800", fontSize: 17, lineHeight: 22, fontFamily: theme.fontFamily }}>{str(item.name)}</Text>
          {place ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="location-outline" size={14} color={theme.colors.muted} />
              <Text numberOfLines={1} style={{ color: theme.colors.muted, fontSize: 12, flex: 1 }}>{place}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
            <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "700" }}>
              {[str(item.mode), Number(item.fee) ? money(item.fee) : ""].filter(Boolean).join(" · ")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ color: theme.colors.primary, fontWeight: "800", fontSize: 12 }}>{closed ? "Details" : "Register"}</Text>
              <Ionicons name="arrow-forward" size={13} color={theme.colors.primary} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
