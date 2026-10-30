import { useRef, useState } from "react";
import { Dimensions, Image, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { mediaUrl, moduleOn, str } from "../../src/api";
import { useBrand, useFeed } from "../../src/feed";
import { currentFlavor } from "../../src/flavor";
import { Banner, BrandMark, Button, Card, Empty, Loading, Muted, Screen, Title } from "../../src/ui";
import { colors } from "../../src/theme";

const EXPLORE: { id: string; href: string; label: string }[] = [
  { id: "articles", href: "/articles", label: "Articles" },
  { id: "videos", href: "/videos", label: "Videos" },
  { id: "gallery", href: "/gallery", label: "Gallery" },
  { id: "notices", href: "/notices", label: "Notices" },
  { id: "about", href: "/about", label: "About" },
  { id: "support", href: "/support", label: "Support" },
  { id: "certificates", href: "/certificates", label: "Certificates" },
  { id: "announcements", href: "/announcements", label: "Announcements" },
  { id: "contact", href: "/contact", label: "Contact" },
];

export default function HomeScreen() {
  const { feed, loading, error, refresh } = useFeed();
  const brand = useBrand();
  const flavor = currentFlavor();
  const enabled = (id: string) => moduleOn(feed, id);
  const [hero, setHero] = useState(0);
  const width = Dimensions.get("window").width - 32;
  const scroller = useRef<ScrollView>(null);
  const flyers = (feed?.flyers ?? []).filter((item) => str(item.image));
  const events = feed?.events ?? [];

  const go = (next: number) => {
    if (!flyers.length) return;
    const index = (next + flyers.length) % flyers.length;
    setHero(index);
    scroller.current?.scrollTo({ x: index * width, animated: true });
  };

  if (loading && !feed) return <Loading />;

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <BrandMark uri={mediaUrl(brand.logoUrl) || undefined} name={brand.name} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
            {flavor.id === "customer" ? "VAIDYA GOGATE" : flavor.displayName}
          </Text>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "800" }}>{brand.name}</Text>
        </View>
        {enabled("shop") ? (
          <Pressable onPress={() => router.push("/cart")} style={{ borderWidth: 1, borderColor: colors.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: colors.burgundy, fontWeight: "700", fontSize: 12 }}>Bag</Text>
          </Pressable>
        ) : null}
      </View>
      <Banner text={error} tone="error" />
      {error ? <Button label="Retry" onPress={() => void refresh()} /> : null}
      {flyers.length ? (
        <View style={{ marginBottom: 14 }}>
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => setHero(Math.round(event.nativeEvent.contentOffset.x / width))}
          >
            {flyers.map((item) => (
              <Pressable
                key={str(item.id)}
                onPress={() => openPublishedHref(str(item.href))}
                style={{ width, height: 168 }}
              >
                <Image
                  accessibilityLabel={str(item.title, "Published flyer")}
                  alt={str(item.title, "Published flyer")}
                  source={{ uri: mediaUrl(item.image) }}
                  style={{ width: width - 4, height: 168, borderRadius: 18, backgroundColor: colors.paper }}
                />
                {str(item.title) && !str(item.image).includes("/slides/") ? (
                  <Text style={{ position: "absolute", left: 14, right: 14, bottom: 14, color: "white", fontWeight: "800" }}>{str(item.title)}</Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          {flyers.length > 1 ? (
            <>
              <Pressable onPress={() => go(hero - 1)} style={arrowStyle("left")}>
                <Text style={arrowText}>‹</Text>
              </Pressable>
              <Pressable onPress={() => go(hero + 1)} style={arrowStyle("right")}>
                <Text style={arrowText}>›</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
      {flyers.length > 1 ? (
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
          {flyers.map((item, index) => (
            <View key={str(item.id)} style={{ width: index === hero ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: index === hero ? colors.burgundy : colors.border }} />
          ))}
        </View>
      ) : null}
      <Text style={{ fontSize: 22, lineHeight: 30, color: colors.ink, fontWeight: "700", marginBottom: 14 }}>{brand.tagline}</Text>
      {flavor.id === "admin" ? (
        <>
        <Muted>Read-only published snapshot. Creating or editing CMS records stays on the website because that desk is stored in the admin browser.</Muted>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          {[
            ["Events", events.length],
            ["Shop", feed?.books.length ?? 0],
            ["Clinics", feed?.clinics.length ?? 0],
            ["Notices", feed?.notices.length ?? 0],
          ].map(([label, count]) => (
            <View key={String(label)} style={{ flex: 1, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>{count}</Text>
              <Muted>{label}</Muted>
            </View>
          ))}
        </View>
        </>
      ) : null}
      {(feed?.announcements ?? []).slice(0, 3).map((item) => (
        <Card key={str(item.id)} onPress={() => router.push("/announcements")}>
          <Text style={{ color: colors.gold, fontSize: 11, fontWeight: "800" }}>{str(item.category, "Notice").toUpperCase()}</Text>
          <Text style={{ fontWeight: "700", fontSize: 16, color: colors.ink, marginTop: 4 }}>{str(item.title)}</Text>
          <Muted>{str(item.description)}</Muted>
        </Card>
      ))}
      <Title>Explore</Title>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {EXPLORE.filter((item) => enabled(item.id)).map((item) => (
          <Pressable key={item.id} onPress={() => router.push(item.href as never)} style={{ backgroundColor: colors.paper, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.burgundy, fontWeight: "700" }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {enabled("events") ? (
        <>
          <Title>Events</Title>
          {events.slice(0, 3).map((item) => (
            <Card key={str(item.id)} onPress={() => router.push(`/event/${str(item.id)}`)}>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>{str(item.name)}</Text>
              <Muted>{str(item.shortDescription, str(item.city))}</Muted>
            </Card>
          ))}
          {!events.length ? <Empty label="Events appear here after Admin publishes the live site." /> : null}
        </>
      ) : null}
      {feed?.flags.supportUs ? (
        <Card>
          <Text style={{ fontWeight: "800", fontSize: 16 }}>{str(feed.flags.supportUsTitle, "Support the Foundation")}</Text>
          <Muted>{str(feed.flags.supportUsText)}</Muted>
        </Card>
      ) : null}
      <Muted>{feed?.publishedAt ? `Updated ${feed.publishedAt}` : "Pull to refresh after Admin publishes."}</Muted>
    </Screen>
  );
}

function openPublishedHref(href: string) {
  if (!href) return;
  if (/^https?:\/\//i.test(href) || /^(mailto:|tel:)/i.test(href)) {
    void Linking.openURL(href);
    return;
  }
  const routes: [RegExp, string][] = [
    [/^\/events\/([^/?#]+)/, "/event/"],
    [/^\/articles\/([^/?#]+)/, "/article/"],
    [/^\/shop\/([^/?#]+)/, "/book/"],
    [/^\/clinics\/([^/?#]+)/, "/clinic/"],
    [/^\/p\//, ""],
  ];
  for (const [pattern, prefix] of routes) {
    const match = href.match(pattern);
    if (!match) continue;
    if (!prefix) return;
    router.push(`${prefix}${match[1]}` as never);
    return;
  }
  if (href.startsWith("/") && !href.startsWith("//")) {
    router.push(href as never);
    return;
  }
}

function arrowStyle(side: "left" | "right") {
  return {
    position: "absolute" as const,
    top: 64,
    [side]: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
}

const arrowText = { color: colors.ink, fontSize: 28, lineHeight: 30, fontWeight: "700" as const };
