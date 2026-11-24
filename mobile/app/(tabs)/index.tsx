import { useRef, useState } from "react";
import { Dimensions, Image, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { isPastDate, mediaUrl, moduleOn, str, type Row } from "../../src/api";
import { ChatFab, FloatingCartStrip, TopBar } from "../../src/chrome";
import { useFeed } from "../../src/feed";
import { CLINIC, resolvedAbout } from "../../src/site-content";
import { Banner, Loading, Portrait, Screen, SiteFooter } from "../../src/ui";
import { EventCard } from "../../src/event-card";
import { ArticleCard } from "./articles";
import { ProductGrid } from "./shop";

const BRAND = "#8F2D2D";
const GREEN = "#067D62";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

const CATEGORIES: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap; href: string; bg: string; fg: string }[] = [
  { id: "shop", label: "Books", icon: "book-outline", href: "/shop", bg: "#FDF2F4", fg: "#8F2D2D" },
  { id: "events", label: "Events", icon: "calendar-outline", href: "/events", bg: "#FFF7ED", fg: "#C2410C" },
  { id: "clinics", label: "Clinics", icon: "medkit-outline", href: "/clinics", bg: "#ECFDF5", fg: "#067D62" },
  { id: "articles", label: "Articles", icon: "newspaper-outline", href: "/articles", bg: "#EFF6FF", fg: "#1D4ED8" },
  { id: "orders", label: "Orders", icon: "cube-outline", href: "/account/orders", bg: "#F0FDF4", fg: "#15803D" },
  { id: "certificates", label: "Certs", icon: "ribbon-outline", href: "/certificates", bg: "#FEFCE8", fg: "#A16207" },
  { id: "notices", label: "Notices", icon: "megaphone-outline", href: "/notices", bg: "#FEF2F2", fg: "#B91C1C" },
  { id: "videos", label: "Videos", icon: "play-circle-outline", href: "/seminar-videos", bg: "#F5F3FF", fg: "#6D28D9" },
  { id: "gallery", label: "Gallery", icon: "images-outline", href: "/gallery", bg: "#ECFEFF", fg: "#0E7490" },
  { id: "explore", label: "Explore", icon: "grid-outline", href: "/explore", bg: "#F9FAFB", fg: "#374151" },
];

const WEBSITE_PAGES: { label: string; icon: keyof typeof Ionicons.glyphMap; href: string }[] = [
  { label: "About Foundation", icon: "business-outline", href: "/about-page/foundation" },
  { label: "Vd. R. B. Gogate", icon: "library-outline", href: "/about-page/legacy" },
  { label: "Dr. Anagha Gogate", icon: "person-outline", href: "/about-page/anagha" },
  { label: "History & Lineage", icon: "time-outline", href: "/about-page/history" },
  { label: "Trustees", icon: "people-outline", href: "/about-page/trustees" },
  { label: "Awards", icon: "trophy-outline", href: "/about-page/awards" },
  { label: "Books & Research", icon: "book-outline", href: "/about-page/scholarship" },
  { label: "Speakers", icon: "mic-outline", href: "/speakers" },
  { label: "Schedules", icon: "calendar-number-outline", href: "/schedules" },
  { label: "Application Status", icon: "trail-sign-outline", href: "/application-status" },
  { label: "Announcements", icon: "megaphone-outline", href: "/announcements" },
  { label: "Videos", icon: "play-circle-outline", href: "/videos" },
  { label: "Gallery", icon: "images-outline", href: "/gallery" },
  { label: "Track Shipment", icon: "navigate-outline", href: "/track" },
  { label: "FAQ", icon: "help-circle-outline", href: "/faq" },
  { label: "Contact Us", icon: "mail-outline", href: "/contact" },
  { label: "Legal & Policies", icon: "shield-checkmark-outline", href: "/legal" },
];

function Band({ children, pad = 16 }: { children: React.ReactNode; pad?: number }) {
  return (
    <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: pad, paddingVertical: 15, marginBottom: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER }}>
      {children}
    </View>
  );
}

function BandHeader({ title, subtitle, onMore, moreLabel }: { title: string; subtitle?: string; onMore?: () => void; moreLabel?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ fontSize: 16.5, fontWeight: "800", color: TEXT, letterSpacing: -0.2 }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{subtitle}</Text> : null}
      </View>
      {onMore ? (
        <Pressable
          onPress={onMore}
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            backgroundColor: "#FDF2F4",
            borderRadius: 999,
            paddingHorizontal: 11,
            paddingVertical: 5,
            opacity: pressed ? 0.78 : 1,
          })}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: BRAND }}>{moreLabel || "View all"}</Text>
          <Ionicons name="chevron-forward" size={13} color={BRAND} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const { feed, notices, loading, error, refresh } = useFeed();
  const voices = ((feed?.seminarReviews ?? []) as Row[]).filter((row) => row.published !== false && str(row.text)).slice(0, 12);
  const about = resolvedAbout(feed?.about);
  const [cert, setCert] = useState("");
  const [hero, setHero] = useState(0);
  const screenW = Dimensions.get("window").width;
  const scroller = useRef<ScrollView>(null);
  const flyers = [...(feed?.banners ?? []), ...(feed?.flyers ?? [])].filter((item) => str(item.image));
  const events = feed?.events ?? [];
  const books = feed?.books ?? [];
  const clinics = feed?.clinics ?? [];
  const customPages = (feed?.pages ?? []).filter((p) => p.enabled !== false && str(p.slug));
  const enabled = (id: string) => moduleOn(feed, id);

  if (loading && !feed) return <Loading />;

  const articles = (feed?.articles ?? []).slice(0, 3);
  const upcoming = events.filter((item) => !isPastDate(item.endDate || item.startDate)).slice(0, 2);
  const eventList = upcoming.length ? upcoming : events.slice(0, 2);
  const clinic = clinics[0];
  const clinicName = str(clinic?.name, CLINIC.name);
  const clinicArea = str(clinic?.city, CLINIC.area);
  const clinicPhone = str(clinic?.phone, CLINIC.phoneLabel);
  const awards = about.awards.slice(0, 4);

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FB" }}>
      <Screen refreshing={loading} onRefresh={refresh}>
        <TopBar bag={enabled("shop")} />
        <Banner text={error} tone="error" />

        {/* Horizontal Category Circle Strip (Pure White + Pastel Icons) */}
        <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingVertical: 13, marginBottom: 8, borderBottomWidth: 1, borderColor: BORDER }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 14 }}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => router.push(cat.href as never)}
                style={({ pressed }) => ({ alignItems: "center", width: 60, opacity: pressed ? 0.78 : 1 })}
              >
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: cat.bg, borderWidth: 1, borderColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginBottom: 5 }}>
                  <Ionicons name={cat.icon} size={22} color={cat.fg} />
                </View>
                <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "700", color: TEXT }}>{cat.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Full-Width Published Flyers Carousel */}
        {flyers.length ? (
          <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, marginBottom: 8, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER }}>
            <ScrollView
              ref={scroller}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => setHero(Math.round(event.nativeEvent.contentOffset.x / Math.max(screenW, 1)))}
            >
              {flyers.map((item) => (
                <Pressable key={str(item.id)} onPress={() => openPublishedHref(str(item.href))} style={{ width: screenW, paddingHorizontal: 14 }}>
                  <Image
                    accessibilityLabel={str(item.title, "Foundation banner")}
                    source={{ uri: mediaUrl(item.image) }}
                    resizeMode="cover"
                    style={{ width: screenW - 28, height: Math.round((screenW - 28) * 0.48), borderRadius: 14, backgroundColor: "#F8F9FB", borderWidth: 1, borderColor: BORDER }}
                  />
                </Pressable>
              ))}
            </ScrollView>
            {flyers.length > 1 ? (
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 9 }}>
                {flyers.map((item, index) => (
                  <View key={str(item.id)} style={{ width: index === hero ? 18 : 6, height: 5, borderRadius: 3, backgroundColor: index === hero ? BRAND : "#D1D5DB" }} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Top Publications (2-Column White E-Commerce Grid) */}
        {enabled("shop") && books.length ? (
          <Band pad={14}>
            <BandHeader title="Top Publications" subtitle="Official VGMF Ayurveda books · Delivery or pickup" onMore={() => router.push("/shop")} />
            <ProductGrid items={books.slice(0, 4)} />
          </Band>
        ) : null}

        {/* Quick Order Tracking & Certificate Shortcuts (Light Airy Cards) */}
        <Band pad={14}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => router.push("/account/orders")}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: BORDER,
                borderRadius: 12,
                padding: 12,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="cube-outline" size={19} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT }}>My Orders</Text>
                <Text style={{ fontSize: 11, color: MUTED }}>Live pipeline</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.push("/certificates")}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: BORDER,
                borderRadius: 12,
                padding: 12,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "#FDF2F4", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="ribbon-outline" size={19} color={BRAND} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT }}>Certificates</Text>
                <Text style={{ fontSize: 11, color: MUTED }}>Verify ID</Text>
              </View>
            </Pressable>
          </View>
        </Band>

        {/* Events & Seminars + Quick Links to Speakers / Schedules / Status */}
        {eventList.length ? (
          <Band pad={14}>
            <BandHeader title="Seminars & Events" subtitle="Register and track applications in the app" onMore={() => router.push("/events")} />
            {eventList.map((item) => (
              <EventCard key={str(item.id)} item={item} />
            ))}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              {[
                { label: "Speakers", icon: "mic-outline" as const, href: "/speakers" },
                { label: "Schedules", icon: "calendar-number-outline" as const, href: "/schedules" },
                { label: "Status", icon: "trail-sign-outline" as const, href: "/application-status" },
              ].map((link) => (
                <Pressable
                  key={link.label}
                  onPress={() => router.push(link.href as never)}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#F8F9FB", borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingVertical: 9 }}
                >
                  <Ionicons name={link.icon} size={14} color={BRAND} />
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: TEXT }}>{link.label}</Text>
                </Pressable>
              ))}
            </View>
          </Band>
        ) : null}

        {/* Foundation Clinic (Pure White Card) */}
        <Band pad={14}>
          <BandHeader title="Foundation Clinic · Pune" subtitle="Ayurvedic OPD consultation & directions" onMore={() => router.push("/clinics")} />
          <View style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="medkit-outline" size={21} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: "800", color: TEXT }}>{clinicName}</Text>
                <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{clinicArea} · {CLINIC.hours}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable
                onPress={() => void Linking.openURL(`tel:${clinicPhone.replace(/\s+/g, "")}`)}
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FDF2F4", borderWidth: 1, borderColor: "#F3D4D8", borderRadius: 10, paddingVertical: 10 }}
              >
                <Ionicons name="call-outline" size={15} color={BRAND} />
                <Text style={{ color: BRAND, fontWeight: "800", fontSize: 13 }}>Call Clinic</Text>
              </Pressable>
              <Pressable
                onPress={() => void Linking.openURL(Platform.OS === "ios" ? `http://maps.apple.com/?q=${encodeURIComponent(`${clinicName}, ${clinicArea}`)}` : CLINIC.maps)}
                style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#F8F9FB", borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingVertical: 10 }}
              >
                <Ionicons name="navigate-outline" size={15} color={TEXT} />
                <Text style={{ color: TEXT, fontWeight: "800", fontSize: 13 }}>Directions</Text>
              </Pressable>
            </View>
          </View>
        </Band>

        {/* Notice Board */}
        {notices.length ? (
          <Band pad={14}>
            <BandHeader title="Notice Board" subtitle="Official notices & announcements" onMore={() => router.push("/notices")} />
            {notices.slice(0, 4).map((item, index) => (
              <Pressable
                key={str(item.id, String(index))}
                onPress={() => router.push("/notices")}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderTopColor: BORDER }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#FDF2F4", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="megaphone-outline" size={16} color={BRAND} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ color: TEXT, fontWeight: "700", fontSize: 13.5 }}>{str(item.title)}</Text>
                  {str(item.date, str(item.publishedAt)) ? (
                    <Text style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{str(item.date, str(item.publishedAt)).slice(0, 10)}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </Pressable>
            ))}
          </Band>
        ) : null}

        {/* Ayurveda Library */}
        {articles.length ? (
          <Band pad={14}>
            <BandHeader title="Ayurveda Library" subtitle="29 clinical articles & essays" onMore={() => router.push("/articles")} />
            {articles.map((item) => (
              <ArticleCard key={str(item.id)} item={item} />
            ))}
          </Band>
        ) : null}

        {/* Participant Reviews */}
        {voices.length ? (
          <Band pad={14}>
            <BandHeader title="Participant Voices" subtitle="Feedback from seminar doctors & students" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {voices.map((row, index) => (
                <View key={str(row.id, String(index))} style={{ width: 256, backgroundColor: "#F8F9FB", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <View style={{ backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#BBF7D0", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Text style={{ color: GREEN, fontSize: 11, fontWeight: "800" }}>{Number(row.rating) || 5}</Text>
                      <Ionicons name="star" size={10} color={GREEN} />
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: "800", color: TEXT, flex: 1 }}>{str(row.name, "Participant")}</Text>
                  </View>
                  <Text numberOfLines={4} style={{ color: "#374151", fontSize: 12.5, lineHeight: 19 }}>
                    {str(row.text).replace(/^[“"]|[”"]$/g, "")}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Band>
        ) : null}

        {/* Certificate Verification */}
        <Band pad={14}>
          <BandHeader title="Verify Certificate" subtitle="Check seminar, workshop or fellowship credentials" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={cert}
              onChangeText={setCert}
              placeholder="e.g. VGMF-2025-PN-034"
              placeholderTextColor="#9CA3AF"
              style={{ flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, height: 44, backgroundColor: "#F8F9FB", color: TEXT, fontSize: 13.5 }}
            />
            <Pressable
              onPress={() => router.push({ pathname: "/certificates", params: { q: cert } })}
              style={{ backgroundColor: BRAND, borderRadius: 10, paddingHorizontal: 18, height: 44, justifyContent: "center" }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 13 }}>Verify</Text>
            </Pressable>
          </View>
        </Band>

        {/* Legacy & Awards */}
        <Band pad={14}>
          <BandHeader title="Foundation Legacy & Awards" subtitle="Vaidya R. B. Gogate & Dr. Anagha Gogate" onMore={() => router.push("/about")} />
          <Pressable onPress={() => router.push("/about-page/legacy")} style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
            <Portrait uri={about.rb.portrait} label={about.rb.title} size={64} fallback={require("../../assets/rb-square.jpg")} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}>{about.rb.title}</Text>
              <Text style={{ fontSize: 11.5, color: BRAND, fontWeight: "700", marginTop: 1 }}>{about.rb.role}</Text>
              <Text numberOfLines={2} style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{about.rb.excerpt}</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => router.push("/about-page/anagha")} style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingTop: 12 }}>
            <Portrait uri={about.anagha.portrait} label={about.anagha.title} size={64} fallback={require("../../assets/anagha-square.jpg")} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}>{about.anagha.title}</Text>
              <Text style={{ fontSize: 11.5, color: BRAND, fontWeight: "700", marginTop: 1 }}>{about.anagha.role}</Text>
              <Text numberOfLines={2} style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{about.anagha.excerpt}</Text>
            </View>
          </Pressable>
          {awards.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 12 }}>
              {awards.map((award, idx) => (
                <Pressable key={idx} onPress={() => router.push("/about-page/awards")} style={{ width: 220, backgroundColor: "#FEFCE8", borderRadius: 12, padding: 11, borderWidth: 1, borderColor: "#FDE68A" }}>
                  <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: "800", color: "#854D0E" }}>{award.title}</Text>
                  <Text numberOfLines={2} style={{ fontSize: 11, color: "#713F12", marginTop: 2 }}>{award.body}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </Band>

        {/* Seminar Videos Section */}
        <Band pad={14}>
          <BandHeader title="Seminar Videos" subtitle="Recorded national seminar sessions & talks" onMore={() => router.push("/seminar-videos")} moreLabel="Watch all" />
          <Pressable
            onPress={() => router.push("/seminar-videos")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: "#F8F9FB",
              borderWidth: 1,
              borderColor: BORDER,
              borderRadius: 14,
              padding: 14,
              opacity: pressed ? 0.86 : 1,
            })}
          >
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="play-circle" size={26} color="#6D28D9" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: "800", color: TEXT }}>Watch Seminar Video Library</Text>
              <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                Access recorded seminar lectures, speaker sessions &amp; unlocked recordings
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>
        </Band>

        {/* Explore Foundation — Dedicated Screen & Quick Links to All Site Sections */}
        <Band pad={14}>
          <BandHeader title="Explore Foundation" subtitle="All sections, programmes, library & policies" onMore={() => router.push("/explore")} moreLabel="See all" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              ...WEBSITE_PAGES.slice(0, 12),
              ...customPages.map((p) => ({ label: str(p.title, str(p.slug)), icon: "document-text-outline" as const, href: `/page/${str(p.slug)}` })),
            ].map((page) => (
              <Pressable
                key={page.href}
                onPress={() => router.push(page.href as never)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: BORDER,
                  borderRadius: 10,
                  paddingHorizontal: 11,
                  paddingVertical: 9,
                  opacity: pressed ? 0.78 : 1,
                })}
              >
                <Ionicons name={page.icon} size={15} color={BRAND} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT }}>{page.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => router.push("/explore")}
            style={({ pressed }) => ({
              marginTop: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: "#FDF2F4",
              borderWidth: 1,
              borderColor: "#F3D4D8",
              borderRadius: 10,
              paddingVertical: 11,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="grid-outline" size={15} color={BRAND} />
            <Text style={{ fontSize: 13, fontWeight: "800", color: BRAND }}>Open Explore Foundation (All Pages)</Text>
          </Pressable>
        </Band>

        <SiteFooter />
        <View style={{ height: 64 }} />
      </Screen>
      <FloatingCartStrip />
      <ChatFab />
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
