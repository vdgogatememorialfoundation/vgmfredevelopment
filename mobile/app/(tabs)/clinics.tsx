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
      <View style={{ backgroundColor: theme.colors.primary, borderRadius: 20, padding: 18, marginBottom: 16 }}>
        <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" }}>Foundation clinic</Text>
        <Text style={{ color: theme.colors.onPrimary, fontSize: 19, fontWeight: "800", marginTop: 6 }}>{CLINIC.name}</Text>
        <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 13, marginTop: 4 }}>{CLINIC.area}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
          <Ionicons name="time-outline" size={16} color={theme.colors.onPrimary} />
          <Text style={{ color: theme.colors.onPrimary, fontWeight: "700", fontSize: 13 }}>{CLINIC.hours}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          {[
            { icon: "call" as const, label: "Call", href: `tel:${CLINIC.phone}` },
            { icon: "mail" as const, label: "Email", href: `mailto:${CLINIC.email}` },
            { icon: "navigate" as const, label: "Directions", href: Platform.OS === "ios" ? `http://maps.apple.com/?q=${encodeURIComponent(`${CLINIC.name}, ${CLINIC.area}`)}` : CLINIC.maps },
          ].map((action) => (
            <Pressable key={action.label} onPress={() => void Linking.openURL(action.href)} accessibilityRole="button" accessibilityLabel={action.label} style={({ pressed }) => [{ flex: 1, backgroundColor: theme.colors.onPrimary, borderRadius: 12, paddingVertical: 10, alignItems: "center", gap: 4, opacity: pressed ? 0.85 : 1 }]}>
              <Ionicons name={action.icon} size={18} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.primary, fontWeight: "800", fontSize: 12 }}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 10 }}>{CLINIC.phoneLabel} · {CLINIC.email}</Text>
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
