import { useMemo, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme";
import { router } from "expo-router";
import { getApiBase, mediaUrl, str } from "../../src/api";
import { TopBar } from "../../src/chrome";
import { useFeed } from "../../src/feed";
import { CLINIC, SITE } from "../../src/site-content";
import { Card, Cover, Empty, Heading, Loading, Muted, PageHeader, Screen, SearchBar, SiteFooter } from "../../src/ui";

export default function ClinicsScreen() {
  const { feed, loading, refresh } = useFeed();
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const items = feed?.clinics ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => !q || [item.name, item.city, item.specialization, item.doctor, item.address].some((value) => str(value).toLowerCase().includes(q)));
  }, [items, query]);
  if (loading && !feed) return <Loading />;
  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <TopBar />
      <PageHeader kicker="Care" title="Foundation clinics" subtitle="Consultation hours and directions for Foundation clinics, as published on the website." />
      <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" }}>
        <Text style={{ color: "#8F2D2D", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Foundation Clinic</Text>
        <Text style={{ color: "#111827", fontSize: 19, fontWeight: "800", marginTop: 6 }}>{CLINIC.name}</Text>
        <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>{CLINIC.area}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: "#F8F9FB", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
          <Ionicons name="time-outline" size={16} color="#067D62" />
          <Text style={{ color: "#111827", fontWeight: "700", fontSize: 13 }}>{CLINIC.hours}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          {[
            { icon: "call-outline" as const, label: "Call", href: `tel:${CLINIC.phone}` },
            { icon: "mail-outline" as const, label: "Email", href: `mailto:${CLINIC.email}` },
            { icon: "navigate-outline" as const, label: "Directions", href: Platform.OS === "ios" ? `http://maps.apple.com/?q=${encodeURIComponent(`${CLINIC.name}, ${CLINIC.area}`)}` : CLINIC.maps },
          ].map((action) => (
            <Pressable key={action.label} onPress={() => void Linking.openURL(action.href)} accessibilityRole="button" accessibilityLabel={action.label} style={({ pressed }) => [{ flex: 1, backgroundColor: "#FDF2F4", borderWidth: 1, borderColor: "#F3D4D8", borderRadius: 10, paddingVertical: 11, alignItems: "center", gap: 4, opacity: pressed ? 0.85 : 1 }]}>
              <Ionicons name={action.icon} size={18} color="#8F2D2D" />
              <Text style={{ color: "#8F2D2D", fontWeight: "800", fontSize: 12 }}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 12 }}>{CLINIC.phoneLabel} · {CLINIC.email}</Text>
      </View>
      <SearchBar value={query} onChange={setQuery} placeholder="Search clinics" />
      {filtered.map((item) => {
        const photo = mediaUrl((item.photos as { src?: string }[] | undefined)?.[0]?.src);
        return (
          <Card key={str(item.id)} onPress={() => router.push(`/clinic/${str(item.id)}`)}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {photo ? (
                <View style={{ width: 80 }}>
                  <Cover uri={photo} height={80} />
                </View>
              ) : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Heading>{str(item.name)}</Heading>
                <Muted>{[str(item.city), str(item.specialization)].filter(Boolean).join(" · ")}</Muted>
                {str(item.doctor) ? <Muted>{str(item.doctor)}</Muted> : null}
                {str(item.address) ? <Muted>{str(item.address)}</Muted> : null}
              </View>
            </View>
          </Card>
        );
      })}
      {!filtered.length ? (
        <Empty
          icon="medical-outline"
          label={items.length ? "No published clinics match that search." : "No clinics are in the published app feed yet. The website Clinics page is the live directory."}
          actionLabel="Open website clinics"
          onAction={() => void Linking.openURL(`${getApiBase()}/clinics`)}
        />
      ) : null}
      <Card>
        <Heading>{SITE.name}</Heading>
        <Muted>{SITE.address}</Muted>
        <Muted>{SITE.email} · {SITE.phone}</Muted>
      </Card>
      <SiteFooter />
    </Screen>
  );
}
