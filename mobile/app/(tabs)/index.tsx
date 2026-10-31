import { useRef, useState } from "react";
import { Dimensions, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { formatDate, mediaUrl, moduleOn, money, str, type Row } from "../../src/api";
import { useCart } from "../../src/cart";
import { ChatFab, TopBar } from "../../src/chrome";
import { useFeed } from "../../src/feed";
import { EXPLORE, PORTALS, SITE, resolvedAbout } from "../../src/site-content";
import { useTheme } from "../../src/theme";
import { Banner, Button, Card, Cover, Heading, IconTile, Kicker, LinkRow, Loading, Muted, Portrait, Price, Screen, SearchBar, SectionHeader, SiteFooter, StatusChip } from "../../src/ui";

export default function HomeScreen() {
  const { feed, loading, error, refresh } = useFeed();
  const theme = useTheme();
  const cart = useCart();
  const about = resolvedAbout(feed?.about);
  const [query, setQuery] = useState("");
  const [cert, setCert] = useState("");
  const [hero, setHero] = useState(0);
  const width = Dimensions.get("window").width - 40;
  const scroller = useRef<ScrollView>(null);
  const flyers = (feed?.flyers ?? []).filter((item) => str(item.image));
  const events = feed?.events ?? [];
  const books = feed?.books ?? [];
  const featured = events[0];
  const enabled = (id: string) => moduleOn(feed, id);

  if (loading && !feed) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
    <Screen refreshing={loading} onRefresh={refresh}>
      <TopBar bag={enabled("shop")} />
      <Kicker>Preserving Ayurveda</Kicker>
      <Text style={{ fontSize: 30, lineHeight: 36, fontWeight: "700", color: theme.colors.primary, fontFamily: theme.fontFamily, letterSpacing: -0.5, marginBottom: 8 }}>
        {str(feed?.site.tagline, SITE.tagline)}
      </Text>
      <Muted>{SITE.purpose}</Muted>
      <View style={{ height: 16 }} />
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search articles, publications, events, clinics…"
        onSubmit={() => router.push({ pathname: "/search", params: { q: query } })}
      />
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
                  style={{ width, height: Math.round(width * 0.52), borderRadius: 16, backgroundColor: theme.colors.paper }}
                />
              </Pressable>
            ))}
          </ScrollView>
          {flyers.length > 1 ? (
            <View style={{ position: "absolute", bottom: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 }}>
              {flyers.map((item, index) => (
                <View key={str(item.id)} style={{ width: index === hero ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: index === hero ? theme.colors.primary : theme.colors.border }} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <SectionHeader title="Explore gateway" subtitle="Services of the Foundation" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
        {EXPLORE.filter((item) => ["certificates", "chat", "contact", "support", "notices"].includes(item.id) || enabled(item.id)).map((item) => (
          <IconTile key={item.id} label={item.label} icon={item.icon} onPress={() => router.push(item.href as never)} />
        ))}
      </View>

      {featured ? (
        <Card onPress={() => router.push(`/event/${str(featured.id)}`)}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Kicker>{str(featured.eventType, "Foundation event")}</Kicker>
            <StatusChip label={[str(featured.city), str(featured.mode)].filter(Boolean).join(" · ") || str(featured.venue)} />
          </View>
          <Heading>{str(featured.name)}</Heading>
          <Muted>{str(featured.shortDescription)}</Muted>
          <Muted>{[str(featured.venue), formatDate(featured.startDate)].filter(Boolean).join(" · ")}</Muted>
          <Button label="Register now" onPress={() => openPublishedHref(str(featured.registrationUrl) || SITE.eventsUrl)} />
        </Card>
      ) : null}

      <SectionHeader title="Foundation pillars & legacy" actionLabel="About" onAction={() => router.push("/about")} />
      <PortraitCard
        uri={about.rb.portrait}
        title={about.rb.title}
        role={about.rb.role}
        body={about.rb.excerpt}
        onPress={() => router.push("/about")}
      />
      <PortraitCard
        uri={about.anagha.portrait}
        title={about.anagha.title}
        role={about.anagha.role}
        body={about.anagha.excerpt}
        onPress={() => router.push("/about")}
      />

      <SectionHeader title="Foundation publications" subtitle="Hardcover · illustrated" actionLabel="Shop all" onAction={() => router.push("/shop")} />
      {books.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {books.slice(0, 4).map((item) => (
            <HomeBook key={str(item.id)} item={item} onAdd={() => cart.add({ id: str(item.id), title: str(item.title), price: Number(item.price) || 0 })} />
          ))}
        </View>
      ) : (
        <Card>
          <Muted>The Foundation catalogue is published from Admin. Until titles appear, open the in-app shop — checkout stays inside VGMF with Razorpay.</Muted>
          <Button kind="ghost" label="Open in-app shop" onPress={() => router.push("/shop")} />
        </Card>
      )}

      <Card>
        <Kicker>Certificate & credential verification</Kicker>
        <Heading>Verify a Foundation certificate</Heading>
        <Muted>Look up workshop, fellowship or seminar credentials issued by VGMF.</Muted>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" }}>
          <TextInput
            value={cert}
            onChangeText={setCert}
            placeholder="e.g. VGMF-2025-PN-034"
            placeholderTextColor={theme.colors.muted}
            accessibilityLabel="Certificate number"
            style={{ flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, minHeight: 48, backgroundColor: theme.colors.background, color: theme.colors.text }}
          />
          <Pressable
            onPress={() => router.push({ pathname: "/certificates", params: { q: cert } })}
            style={{ backgroundColor: theme.colors.primary, borderRadius: 12, paddingHorizontal: 16, minHeight: 48, justifyContent: "center" }}
          >
            <Text style={{ color: theme.colors.onPrimary, fontWeight: "800", fontSize: 12 }}>Verify</Text>
          </Pressable>
        </View>
      </Card>

      <SectionHeader title="Specialized portals" subtitle="Affiliated bodies" />
      {PORTALS.map((portal) => (
        <Card key={portal.id} onPress={() => void Linking.openURL(portal.href)}>
          <Heading>{portal.title}</Heading>
          <Muted>{portal.body}</Muted>
          <LinkRow label="Open portal" onPress={() => void Linking.openURL(portal.href)} />
        </Card>
      ))}

      <SiteFooter />
    </Screen>
    <ChatFab />
    </View>
  );
}

function PortraitCard({ uri, title, role, body, onPress }: { uri?: string; title: string; role: string; body: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
        <Portrait uri={uri} label={title} size={80} />
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

function HomeBook({ item, onAdd }: { item: Row; onAdd: () => void }) {
  const theme = useTheme();
  const price = Number(item.price) || 0;
  const original = Number(item.originalPrice) || 0;
  return (
    <View style={{ width: "48%", backgroundColor: theme.colors.paper, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 16, padding: 10, marginBottom: 8 }}>
      <Pressable onPress={() => router.push(`/book/${str(item.id)}`)}>
        <Cover uri={mediaUrl(item.coverImage) || undefined} ratio="square" />
        <Heading>{str(item.title)}</Heading>
        <Muted>{str(item.author)}</Muted>
        <Price value={money(price)} original={original > price ? money(original) : undefined} />
      </Pressable>
      <Button label="Add to bag" kind="ghost" icon="bag-handle-outline" onPress={onAdd} />
    </View>
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
    const origin = str((globalThis as { location?: { origin?: string } }).location?.origin);
    void Linking.openURL(`https://staging.vaidyagogate.org${href}`);
    void origin;
  }
}
