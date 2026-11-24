import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { isRegistrationClosed, mediaUrl, money, str, type Row } from "./api";
import { useTheme } from "./theme";
import { Tag } from "./ui";

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
  const banner = mediaUrl(item.bannerUrl);

  return (
    <Pressable
      onPress={() => router.push(`/event/${str(item.id)}`)}
      accessibilityRole="button"
      accessibilityLabel={str(item.name)}
      style={({ pressed }) => [
        {
          backgroundColor: theme.colors.paper,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: 16,
          overflow: "hidden",
          shadowColor: "#16181D",
          shadowOpacity: 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      {banner ? (
        <Image source={{ uri: banner }} accessibilityLabel={str(item.name)} style={{ width: "100%", height: 158, backgroundColor: theme.colors.surface }} resizeMode="cover" />
      ) : null}
      <View style={{ flexDirection: "row", gap: 14, padding: 16 }}>
        <View
          style={{
            width: 60,
            borderRadius: 16,
            backgroundColor: theme.colors.primary,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 10,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: "#FCE9B8", fontSize: 10, fontWeight: "800", letterSpacing: 1 }}>{when.month}</Text>
          <Text style={{ color: theme.colors.onPrimary, fontSize: 23, fontWeight: "900", lineHeight: 27 }}>{when.day}</Text>
          <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 10, fontWeight: "700" }}>{when.year}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Tag label={str(item.eventType, "Event")} tone="ink" />
            <Tag label={closed ? "Closed" : "Open"} tone={closed ? "red" : "green"} />
          </View>
          <Text style={{ color: theme.colors.text, fontWeight: "700", fontSize: 16.5, lineHeight: 22, fontFamily: theme.fontFamily }} numberOfLines={2}>
            {str(item.name)}
          </Text>
          {place ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="location-outline" size={14} color={theme.colors.muted} />
              <Text numberOfLines={1} style={{ color: theme.colors.muted, fontSize: 12.5, flex: 1 }}>{place}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
            <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: "800" }}>
              {[str(item.mode), Number(item.fee) ? money(item.fee) : "Free"].filter(Boolean).join(" · ")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.colors.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
              <Text style={{ color: theme.colors.primary, fontWeight: "800", fontSize: 12 }}>{closed ? "Details" : "Register"}</Text>
              <Ionicons name="arrow-forward" size={12} color={theme.colors.primary} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
