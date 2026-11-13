import { useRef, useState } from "react";
import { Dimensions, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { isPastDate, mediaUrl, moduleOn, str } from "../../src/api";
import { ChatFab, TopBar } from "../../src/chrome";
import { useFeed } from "../../src/feed";
import { QUICK_ACTIONS, resolvedAbout } from "../../src/site-content";
import { useTheme } from "../../src/theme";
import { Banner, Card, Heading, Hero, IconTile, Kicker, LinkRow, Loading, Muted, Portrait, Screen, SearchBar, SectionHeader, SiteFooter } from "../../src/ui";
import { EventCard } from "../../src/event-card";
import { ArticleCard } from "./articles";
import { ProductGrid } from "./shop";

export default function HomeScreen() {
  const { feed, notices, loading, error, refresh } = useFeed();
  const theme = useTheme();
  const about = resolvedAbout(feed?.about);
  const [query, setQuery] = useState("");
  const [cert, setCert] = useState("");
  const [hero, setHero] = useState(0);
  const width = Dimensions.get("window").width - 40;
  const scroller = useRef<ScrollView>(null);
  const flyers = [...(feed?.banners ?? []), ...(feed?.flyers ?? [])].filter((item) => str(item.image));
  const events = feed?.events ?? [];
  const books = feed?.books ?? [];
  const featured = events.find((item) => !isPastDate(item.endDate || item.startDate)) || events[0];
  const enabled = (id: string) => moduleOn(feed, id);

  if (loading && !feed) return <Loading />;

  const articles = (feed?.articles ?? []).slice(0, 3);
  const upcoming = events.filter((item) => !isPastDate(item.endDate || item.startDate)).slice(0, 2);
  const eventList = upcoming.length ? upcoming : featured ? [featured] : [];

  return (
    <View style={{ flex: 1 }}>
    <Screen refreshing={loading} onRefresh={refresh}>
      <TopBar bag={enabled("shop")} />
      <Banner text={error} tone="error" />

      {flyers.length ? (
        <View style={{ marginBottom: 18, height: Math.round(width * 0.52) }}>
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => setHero(Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1)))}
          >
            {flyers.map((item) => (
              <Pressable key={str(item.id)} onPress={() => openPublishedHref(str(item.href))} style={{ width, height: Math.round(width * 0.52) }}>
                <Image
                  accessibilityLabel={str(item.title, "Foundation flyer")}
                  source={{ uri: mediaUrl(item.image) }}
                  resizeMode="cover"
                  style={{ width, height: Math.round(width * 0.52), borderRadius: 10, backgroundColor: theme.colors.paper }}
                />
              </Pressable>
            ))}
          </ScrollView>
          {flyers.length > 1 ? (
            <View style={{ position: "absolute", bottom: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 }}>
              {flyers.map((item, index) => (
                <View key={str(item.id)} style={{ width: index === hero ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: index === hero ? theme.colors.paper : "rgba(255,255,255,0.6)" }} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={{ backgroundColor: theme.colors.paper, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 6, marginBottom: 20, flexDirection: "row", flexWrap: "wrap", elevation: 2, shadowColor: "#3B2A14", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
        {QUICK_ACTIONS.filter((item) => enabled(item.id) || ["certificates", "about"].includes(item.id)).map((item) => (
          <IconTile key={item.id} label={item.label} icon={item.icon} onPress={() => router.push(item.href as never)} />
        ))}
      </View>

      {notices.length ? (
        <>
          <SectionHeader title="Notice board" subtitle="From the Foundation office" actionLabel="All notices" onAction={() => router.push("/notices")} />
          <View style={{ backgroundColor: theme.colors.paper, borderRadius: 18, borderLeftWidth: 4, borderLeftColor: theme.colors.accent, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 20 }}>
            {notices.slice(0, 3).map((item, index) => (
              <Pressable key={str(item.id, String(index))} onPress={() => router.push("/notices")} style={{ paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: theme.colors.border }}>
                <Text numberOfLines={2} style={{ color: theme.colors.text, fontWeight: "700", fontSize: 14 }}>{str(item.title)}</Text>
                {str(item.date, str(item.publishedAt)) ? <Text style={{ color: theme.colors.muted, fontSize: 11, marginTop: 3 }}>{str(item.date, str(item.publishedAt)).slice(0, 10)}</Text> : null}
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {enabled("shop") && books.length ? (
        <>
          <SectionHeader title="Shop & publications" subtitle="Order in the app · delivery or store pickup" actionLabel="View all" onAction={() => router.push("/shop")} />
          <ProductGrid items={books.slice(0, 4)} />
        </>
      ) : null}

      {eventList.length ? (
        <>
          <SectionHeader title={upcoming.length ? "Upcoming events" : "Events"} subtitle="Seminars, workshops and programmes" actionLabel="All events" onAction={() => router.push("/events")} />
          {eventList.map((item) => (
            <EventCard key={str(item.id)} item={item} />
          ))}
        </>
      ) : null}

      {articles.length ? (
        <>
          <SectionHeader title="Latest articles" subtitle="From the Foundation library" actionLabel="All articles" onAction={() => router.push("/articles")} />
          {articles.map((item) => (
            <ArticleCard key={str(item.id)} item={item} />
          ))}
        </>
      ) : null}

      <SectionHeader title="Foundation pillars & legacy" actionLabel="About" onAction={() => router.push("/about")} />
      <PortraitCard
        uri={about.rb.portrait}
        title={about.rb.title}
        role={about.rb.role}
        body={about.rb.excerpt}
        fallback={require("../../assets/rb-square.jpg")}
        onPress={() => router.push("/about")}
      />
      <PortraitCard
        uri={about.anagha.portrait}
        title={about.anagha.title}
        role={about.anagha.role}
        body={about.anagha.excerpt}
        fallback={require("../../assets/anagha-square.jpg")}
        onPress={() => router.push("/about")}
      />

      <Card featured>
        <Kicker>Certificate verification</Kicker>
        <Heading>Verify a Foundation certificate</Heading>
        <Muted>Look up workshop, fellowship or seminar credentials issued by the Foundation.</Muted>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" }}>
          <TextInput
            value={cert}
            onChangeText={setCert}
            placeholder="e.g. VGMF-2025-PN-034"
            placeholderTextColor={theme.colors.muted}
            accessibilityLabel="Certificate number"
            style={{ flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, minHeight: 48, backgroundColor: theme.colors.background, color: theme.colors.text }}
          />
          <Pressable
            onPress={() => router.push({ pathname: "/certificates", params: { q: cert } })}
            style={{ backgroundColor: theme.colors.secondary, borderRadius: 8, paddingHorizontal: 16, minHeight: 48, justifyContent: "center" }}
          >
            <Text style={{ color: theme.colors.onPrimary, fontWeight: "800", fontSize: 12 }}>Verify</Text>
          </Pressable>
        </View>
      </Card>

      <SiteFooter />
    </Screen>
    <ChatFab />
    </View>
  );
}

function PortraitCard({ uri, title, role, body, onPress, fallback }: { uri?: string; title: string; role: string; body: string; onPress: () => void; fallback?: number }) {
  const theme = useTheme();
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
        <Portrait uri={uri} label={title} size={80} fallback={fallback} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Heading>{title}</Heading>
          <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 3 }}>{role}</Text>
          <Muted>{body}</Muted>
          <LinkRow label="Read legacy" onPress={onPress} />
        </View>
      </View>
    </Card>
  );
}

export function openPublishedHref(href: string) {
  if (!href) return;
  if (/^\/notices(\/|$)/.test(href)) return;
  if (/^https?:\/\//i.test(href) || /^(mailto:|tel:)/i.test(href)) {
    void Linking.openURL(href);
    return;
  }
  const routes: [RegExp, string][] = [
    [/^\/events\/([^/?#]+)/, "/event/"],
    [/^\/articles\/([^/?#]+)/, "/article/"],
    [/^\/shop\/([^/?#]+)/, "/book/"],
    [/^\/clinics\/([^/?#]+)/, "/clinic/"],
    [/^\/p\/([^/?#]+)/, "/page/"],
  ];
  for (const [pattern, prefix] of routes) {
    const match = href.match(pattern);
    if (!match) continue;
    if (!prefix) return;
    router.push(`${prefix}${match[1]}` as never);
    return;
  }
  if (href.startsWith("/") && !href.startsWith("//")) router.push({ pathname: "/web", params: { path: href } });
}
