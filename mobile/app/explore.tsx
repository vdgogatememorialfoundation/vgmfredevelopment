import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { str } from "../src/api";
import { useFeed } from "../src/feed";
import { Screen, SiteFooter } from "../src/ui";

const BRAND = "#8F2D2D";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

type ExploreItem = {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  tint?: string;
  fg?: string;
};

const GROUPS: { title: string; items: ExploreItem[] }[] = [
  {
    title: "About & Heritage",
    items: [
      { label: "About VGMF", subtitle: "Vision, motto and overview", icon: "information-circle-outline", href: "/about" },
      { label: "The Foundation", subtitle: "Mission & propagation of Ayurveda", icon: "business-outline", href: "/about-page/foundation" },
      { label: "Legacy of Vd. R. B. Gogate", subtitle: "Life, clinical work & biography", icon: "library-outline", href: "/about-page/legacy" },
      { label: "Dr. Anagha Gogate", subtitle: "Trustee & senior scholar", icon: "person-outline", href: "/about-page/anagha" },
      { label: "History & Lineage", subtitle: "Generations of Ayurvedic service", icon: "time-outline", href: "/about-page/history" },
      { label: "Trustees", subtitle: "Governing family & stewardship", icon: "people-outline", href: "/about-page/trustees" },
      { label: "Awards & Recognition", subtitle: "National & academic honours", icon: "trophy-outline", href: "/about-page/awards" },
      { label: "Books & Research", subtitle: "Published scholarship & monographs", icon: "book-outline", href: "/about-page/scholarship" },
    ],
  },
  {
    title: "Seminars & Programmes",
    items: [
      { label: "Events & Seminars", subtitle: "Upcoming & past Foundation events", icon: "calendar-outline", href: "/events", tint: "#FFF7ED", fg: "#C2410C" },
      { label: "Seminar Videos", subtitle: "Recorded seminar sessions & lectures", icon: "play-circle-outline", href: "/seminar-videos", tint: "#F5F3FF", fg: "#6D28D9" },
      { label: "Speakers", subtitle: "Eminent Vaidyas & faculty", icon: "mic-outline", href: "/speakers", tint: "#FFF7ED", fg: "#C2410C" },
      { label: "Event Schedules", subtitle: "Session timings & agendas", icon: "calendar-number-outline", href: "/schedules", tint: "#FFF7ED", fg: "#C2410C" },
      { label: "Application Status", subtitle: "Track fellowship & seminar status", icon: "trail-sign-outline", href: "/application-status", tint: "#ECFDF5", fg: "#067D62" },
      { label: "Verify Certificate", subtitle: "Verify issued VGMF credentials", icon: "ribbon-outline", href: "/certificates", tint: "#FEFCE8", fg: "#A16207" },
    ],
  },
  {
    title: "Shop, Orders & Clinics",
    items: [
      { label: "Publications & Shop", subtitle: "Order Ayurveda books online", icon: "bag-handle-outline", href: "/shop", tint: "#FDF2F4", fg: "#8F2D2D" },
      { label: "Shopping Cart", subtitle: "Review bag & Razorpay checkout", icon: "cart-outline", href: "/cart", tint: "#FDF2F4", fg: "#8F2D2D" },
      { label: "My Orders", subtitle: "Live order tracking & invoices", icon: "cube-outline", href: "/account/orders", tint: "#ECFDF5", fg: "#067D62" },
      { label: "Track a Shipment", subtitle: "Look up parcel by order or AWB", icon: "navigate-outline", href: "/track", tint: "#ECFDF5", fg: "#067D62" },
      { label: "Foundation Clinics", subtitle: "Pune OPD timings & directions", icon: "medkit-outline", href: "/clinics", tint: "#ECFDF5", fg: "#067D62" },
    ],
  },
  {
    title: "Library & Updates",
    items: [
      { label: "Ayurveda Articles", subtitle: "Clinical papers & essays", icon: "newspaper-outline", href: "/articles", tint: "#EFF6FF", fg: "#1D4ED8" },
      { label: "Notice Board", subtitle: "Official circulars & notices", icon: "notifications-outline", href: "/notices", tint: "#FEF2F2", fg: "#B91C1C" },
      { label: "Announcements", subtitle: "Latest Foundation news", icon: "megaphone-outline", href: "/announcements", tint: "#FEF2F2", fg: "#B91C1C" },
      { label: "Video Library", subtitle: "Public talks & Foundation media", icon: "videocam-outline", href: "/videos", tint: "#F5F3FF", fg: "#6D28D9" },
      { label: "Photo Gallery", subtitle: "Moments from Foundation events", icon: "images-outline", href: "/gallery", tint: "#ECFEFF", fg: "#0E7490" },
      { label: "Search Everything", subtitle: "Search books, events, articles & more", icon: "search-outline", href: "/search", tint: "#F8F9FB", fg: "#111827" },
    ],
  },
  {
    title: "Support, Legal & Policies",
    items: [
      { label: "Foundation Help Chat", subtitle: "Chat with our assistant & desk", icon: "chatbubbles-outline", href: "/chat" },
      { label: "Support Desk", subtitle: "Raise & track support tickets", icon: "headset-outline", href: "/support" },
      { label: "Contact Us", subtitle: "Office phone, email & address", icon: "mail-outline", href: "/contact" },
      { label: "FAQ", subtitle: "Common questions & answers", icon: "help-circle-outline", href: "/faq" },
      { label: "Legal Information", subtitle: "Trust disclosures & compliance", icon: "scale-outline", href: "/legal" },
      { label: "Return Policy", subtitle: "Returns & damaged replacements", icon: "return-down-back-outline", href: "/policy/returns" },
      { label: "Refund Policy", subtitle: "Refund timelines & bank credits", icon: "cash-outline", href: "/policy/refund" },
      { label: "Shipping Policy", subtitle: "Courier charges & store pickup", icon: "cube-outline", href: "/policy/shipping" },
      { label: "Cancellation Policy", subtitle: "Order cancellation rules", icon: "close-circle-outline", href: "/policy/cancellation" },
      { label: "Privacy Policy", subtitle: "How VGMF protects your data", icon: "shield-checkmark-outline", href: "/policy/privacy" },
      { label: "Terms of Use", subtitle: "Website & app terms", icon: "document-text-outline", href: "/policy/terms" },
    ],
  },
];

export default function ExploreScreen() {
  const { feed } = useFeed();
  const customPages = (feed?.pages ?? []).filter((p) => p.enabled !== false && str(p.slug));
  const allGroups = customPages.length
    ? [
        ...GROUPS,
        {
          title: "Published Pages",
          items: customPages.map((p): ExploreItem => ({
            label: str(p.title, str(p.slug)),
            subtitle: str(p.subtitle, "Published Foundation page"),
            icon: "document-text-outline",
            href: `/page/${str(p.slug)}`,
          })),
        },
      ]
    : GROUPS;

  return (
    <Screen>
      <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, marginTop: -8, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderBottomWidth: 1, borderColor: BORDER }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: TEXT }}>Explore Foundation</Text>
        <Text style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>
          Every section, programme, publication, clinic, library and policy of Vaidya Gogate Memorial Foundation.
        </Text>
      </View>

      {allGroups.map((group) => (
        <View
          key={group.title}
          style={{
            backgroundColor: "#FFFFFF",
            marginHorizontal: -20,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 4,
            marginBottom: 8,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: BORDER,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT, marginBottom: 6 }}>{group.title}</Text>
          {group.items.map((item, idx) => (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: idx === group.items.length - 1 ? 0 : 1,
                borderBottomColor: "#F3F4F6",
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: item.tint || "#FDF2F4", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={item.icon} size={18} color={item.fg || BRAND} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT }}>{item.label}</Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Pressable>
          ))}
        </View>
      ))}
      <SiteFooter />
    </Screen>
  );
}
