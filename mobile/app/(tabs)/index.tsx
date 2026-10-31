import { useRef, useState } from "react";
import { Dimensions, Image, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatDate, mediaUrl, moduleOn, money, str, type Row } from "../../src/api";
import { useAuth } from "../../src/auth";
import { useCart } from "../../src/cart";
import { useBrand, useFeed } from "../../src/feed";
import { currentFlavor } from "../../src/flavor";
import { NoticesBoard } from "../../src/notices-list";
import {
  Banner,
  BrandMark,
  Button,
  Card,
  Cover,
  DateBadge,
  Heading,
  IconButton,
  IconTile,
  Loading,
  Muted,
  Price,
  Screen,
  SearchBar,
  SectionHeader,
  StatusChip,
} from "../../src/ui";
import { useTheme } from "../../src/theme";
import type { HomeSectionId } from "../../src/appearance";

const CATEGORIES: { id: string; href: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "shop", href: "/shop", label: "Publications", icon: "book-outline" },
  { id: "events", href: "/events", label: "Events", icon: "calendar-outline" },
  { id: "articles", href: "/articles", label: "Articles", icon: "newspaper-outline" },
  { id: "clinics", href: "/clinics", label: "Clinics", icon: "medical-outline" },
  { id: "certificates", href: "/certificates", label: "Certificates", icon: "ribbon-outline" },
  { id: "videos", href: "/videos", label: "Videos", icon: "play-circle-outline" },
  { id: "gallery", href: "/gallery", label: "Gallery", icon: "images-outline" },
  { id: "about", href: "/about", label: "About", icon: "people-outline" },
  { id: "support", href: "/support", label: "Support", icon: "heart-outline" },
  { id: "contact", href: "/contact", label: "Contact", icon: "mail-outline" },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const { feed, loading, error, refresh } = useFeed();
  const brand = useBrand();
  const flavor = currentFlavor();
  const theme = useTheme();
  const cart = useCart();
  const { session } = useAuth();
  const enabled = (id: string) => moduleOn(feed, id);
  const [hero, setHero] = useState(0);
  const [query, setQuery] = useState("");
  const width = Dimensions.get("window").width - theme.space.md * 2;
  const size = width;
  const scroller = useRef<ScrollView>(null);
  const flyers = (feed?.flyers ?? []).filter((item) => str(item.image));
  const events = feed?.events ?? [];
  const books = feed?.books ?? [];
  const articles = feed?.articles ?? [];
  const videos = feed?.videos ?? [];
  const gallery = feed?.gallery ?? [];

  const go = (next: number) => {
    if (!flyers.length) return;
    const index = (next + flyers.length) % flyers.length;
    setHero(index);
    scroller.current?.scrollTo({ x: index * width, animated: true });
  };

  if (loading && !feed) {
    return (
      <Screen>
        <View style={{ gap: 12 }}>
          <View style={{ height: 56, borderRadius: 28, backgroundColor: theme.colors.border }} />
          <View style={{ aspectRatio: 1, borderRadius: 18, backgroundColor: theme.colors.border }} />
          <View style={{ height: 88, borderRadius: 16, backgroundColor: theme.colors.border }} />
        </View>
      </Screen>
    );
  }

  const sectionOn = (id: HomeSectionId) => {
    const config = theme.section(id);
    if (config && config.visible === false) return false;
    if (id === "support") return Boolean(feed?.flags.supportUs);
    if (id === "notices") return enabled("notices");
    if (id === "carousel") return flyers.length > 0;
    if (id === "categories") return true;
    if (id === "about") return enabled("about");
    return enabled(id);
  };

  const renderSection = (id: HomeSectionId) => {
    if (!sectionOn(id)) return null;
    const config = theme.section(id);
    if (id === "carousel") {
      return (
        <View key="carousel" style={{ marginBottom: 16, height: size }}>
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => setHero(Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1)))}
          >
            {flyers.map((item) => (
              <Pressable key={str(item.id)} onPress={() => openPublishedHref(str(item.href))} style={{ width, height: size, alignItems: "center" }}>
                <Image
                  accessibilityLabel={str(item.title, "Published flyer")}
                  source={{ uri: mediaUrl(item.image) }}
                  resizeMode="contain"
                  style={{ width: size, height: size, borderRadius: theme.radius.lg, backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.border }}
                />
              </Pressable>
            ))}
          </ScrollView>
          {flyers.length > 1 ? (
            <>
              <Pressable onPress={() => go(hero - 1)} accessibilityLabel="Previous slide" style={arrowStyle("left", size, theme.colors.paper)}>
                <Text style={{ color: theme.colors.text, fontSize: 28, lineHeight: 30, fontWeight: "700" }}>‹</Text>
              </Pressable>
              <Pressable onPress={() => go(hero + 1)} accessibilityLabel="Next slide" style={arrowStyle("right", size, theme.colors.paper)}>
                <Text style={{ color: theme.colors.text, fontSize: 28, lineHeight: 30, fontWeight: "700" }}>›</Text>
              </Pressable>
            </>
          ) : null}
          {flyers.length > 1 ? (
            <View style={{ position: "absolute", bottom: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 }}>
              {flyers.map((item, index) => (
                <View
                  key={str(item.id)}
                  style={{
                    width: index === hero ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: index === hero ? theme.colors.primary : theme.colors.border,
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
      );
    }
    if (id === "categories") {
      const items = CATEGORIES.filter((item) => item.id === "contact" || enabled(item.id));
      if (!items.length) return null;
      return (
        <View key="categories" style={{ marginBottom: 8 }}>
          <SectionHeader title={config?.title || "Explore the Foundation"} subtitle={config?.subtitle} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {items.map((item) => (
              <IconTile key={item.id} label={item.label} icon={item.icon} onPress={() => router.push(item.href as never)} />
            ))}
          </View>
        </View>
      );
    }
    if (id === "events") {
      if (!events.length) return null;
      return (
        <View key="events">
          <SectionHeader title={config?.title || theme.labels.events} subtitle={config?.subtitle} actionLabel="See all" onAction={() => router.push("/events")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
            {events.slice(0, 8).map((item) => (
              <Pressable key={str(item.id)} onPress={() => router.push(`/event/${str(item.id)}`)} style={{ width: 232 }}>
                <Card>
                  <Cover uri={mediaUrl(item.bannerUrl) || undefined} height={118} />
                  <DateBadge label={formatDate(item.startDate)} />
                  <View style={{ marginTop: 8 }}>
                    <Heading>{str(item.name)}</Heading>
                  </View>
                  <Muted>{[str(item.city), str(item.venue)].filter(Boolean).join(" · ")}</Muted>
                  <StatusChip label={str(item.registrationStatus)} />
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      );
    }
    if (id === "shop") {
      if (!books.length) return null;
      return (
        <View key="shop">
          <SectionHeader title={config?.title || theme.labels.shop} subtitle={config?.subtitle} actionLabel="See all" onAction={() => router.push("/shop")} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {books.slice(0, theme.columns === 2 ? 4 : 3).map((item) => (
              <ProductTile key={str(item.id)} item={item} columns={theme.columns} />
            ))}
          </View>
        </View>
      );
    }
    if (id === "articles") {
      if (!articles.length) return null;
      return (
        <View key="articles">
          <SectionHeader title={config?.title || "Articles"} subtitle={config?.subtitle} actionLabel="See all" onAction={() => router.push("/articles")} />
          {articles.slice(0, 3).map((item) => (
            <Card key={str(item.id)} onPress={() => router.push(`/article/${str(item.id)}`)}>
              <Heading>{str(item.title)}</Heading>
              <Muted>{[str(item.author), formatDate(item.date)].filter(Boolean).join(" · ")}</Muted>
            </Card>
          ))}
        </View>
      );
    }
    if (id === "videos") {
      if (!videos.length) return null;
      return (
        <View key="videos">
          <SectionHeader title={config?.title || "Videos"} subtitle={config?.subtitle} actionLabel="See all" onAction={() => router.push("/videos")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {videos.slice(0, 6).map((item) => (
              <View key={str(item.id)} style={{ width: 232 }}>
                <Card onPress={() => str(item.youtubeUrl, str(item.src)) && void Linking.openURL(str(item.youtubeUrl, str(item.src)))}>
                  <Cover uri={mediaUrl(item.poster) || undefined} height={118} />
                  <Heading>{str(item.title)}</Heading>
                </Card>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }
    if (id === "gallery") {
      if (!gallery.length) return null;
      return (
        <View key="gallery">
          <SectionHeader title={config?.title || "Gallery"} subtitle={config?.subtitle} actionLabel="See all" onAction={() => router.push("/gallery")} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {gallery.slice(0, 4).map((item) => (
              <Image
                key={str(item.id)}
                source={{ uri: mediaUrl(item.src) }}
                accessibilityLabel={str(item.title, "Gallery photo")}
                style={{ width: "48%", aspectRatio: 1, borderRadius: theme.radius.md, backgroundColor: theme.colors.paper }}
                resizeMode="cover"
              />
            ))}
          </View>
        </View>
      );
    }
    if (id === "notices") {
      return (
        <View key="notices">
          <NoticesBoard title={config?.title || theme.labels.notices} />
        </View>
      );
    }
    if (id === "about") {
      const intro = str(feed?.about?.intro);
      if (!intro) return null;
      return (
        <View key="about">
          <SectionHeader title={config?.title || "The Foundation"} subtitle={config?.subtitle} actionLabel="Read more" onAction={() => router.push("/about")} />
          <Card onPress={() => router.push("/about")}>
            <Muted>{intro.split(/\n\s*\n/)[0]}</Muted>
          </Card>
        </View>
      );
    }
    if (id === "support" && feed?.flags.supportUs) {
      return (
        <Card key="support" featured>
          <Heading>{str(feed.flags.supportUsTitle, config?.title || "Support the Foundation")}</Heading>
          <Muted>{str(feed.flags.supportUsText)}</Muted>
          {str(feed.flags.supportUsHref) ? <Button kind="ghost" icon="mail-outline" label="Contact" onPress={() => router.push("/contact")} /> : null}
        </Card>
      );
    }
    return null;
  };

  return (
    <Screen refreshing={loading} onRefresh={refresh} pad>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <BrandMark uri={mediaUrl(brand.logoUrl) || undefined} name={brand.name} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 }}>
            {flavor.id === "customer" ? "VAIDYA GOGATE" : flavor.displayName}
          </Text>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }} numberOfLines={1}>
            {session?.name ? `${greeting()}, ${session.name.split(" ")[0]}` : greeting()}
          </Text>
          <Text style={{ color: theme.colors.muted, fontSize: 12 }} numberOfLines={1}>
            {brand.tagline || brand.name}
          </Text>
        </View>
        <IconButton icon={session ? "person-circle" : "person-circle-outline"} label="Account" onPress={() => router.push("/account")} />
        {enabled("shop") ? (
          <IconButton icon="bag-handle-outline" label={theme.labels.bag} badge={cart.count} onPress={() => router.push("/cart")} />
        ) : null}
      </View>
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder={theme.labels.searchPlaceholder}
        onSubmit={() => router.push({ pathname: "/search", params: { q: query } })}
      />
      <Banner text={error} tone="error" />
      {error ? <Button label="Retry" icon="refresh-outline" onPress={() => void refresh()} /> : null}
      {flavor.id === "admin" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {[
            ["Events", events.length],
            ["Shop", books.length],
            ["Clinics", feed?.clinics.length ?? 0],
            ["Notices", feed?.notices.length ?? 0],
          ].map(([label, count]) => (
            <View
              key={String(label)}
              style={{ width: "48%", backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.lg, padding: 14 }}
            >
              <Text style={{ fontSize: 22, fontWeight: "800", color: theme.colors.text }}>{count}</Text>
              <Muted>{String(label)} in the published snapshot</Muted>
            </View>
          ))}
          <Muted>Read-only published snapshot. Editing the CMS stays on the website.</Muted>
        </View>
      ) : null}
      {theme.appearance.homeSections.map((section) => renderSection(section.id))}
    </Screen>
  );
}

function ProductTile({ item, columns }: { item: Row; columns: 1 | 2 }) {
  const theme = useTheme();
  const width = columns === 2 ? ("48%" as const) : ("100%" as const);
  const original = Number(item.originalPrice) || 0;
  const price = Number(item.price) || 0;
  return (
    <Pressable onPress={() => router.push(`/book/${str(item.id)}`)} style={{ width }}>
      <View style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.lg, padding: 10, marginBottom: 8 }}>
        <Cover uri={mediaUrl(item.coverImage) || undefined} ratio="square" />
        <Heading>{str(item.title)}</Heading>
        <Muted>{str(item.author)}</Muted>
        <Price value={money(price)} original={original > price ? money(original) : undefined} />
      </View>
    </Pressable>
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
    router.push(href as never);
  }
}

function arrowStyle(side: "left" | "right", size: number, backgroundColor: string) {
  return {
    position: "absolute" as const,
    top: size / 2 - 18,
    [side]: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
}
