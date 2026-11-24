import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ACCOUNT_SECTIONS, type AccountSection } from "../../src/account-nav";
import { useAuth } from "../../src/auth";
import { useCart } from "../../src/cart";
import { ChatFab, TopBar } from "../../src/chrome";
import { useFeed } from "../../src/feed";
import { useWishlist } from "../../src/wishlist";
import { Loading, Screen, SiteFooter } from "../../src/ui";

const BRAND = "#8F2D2D";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

/** ALL 16 website account options organized cleanly into 3 white edge-to-edge bands. */
const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Orders, Wallet & Payments", ids: ["orders", "wallet", "payments", "receipts", "wishlist", "cards", "addresses", "loyalty"] },
  { title: "Programmes & Content", ids: ["registrations", "applications", "seminar-videos", "notifications", "subscriptions"] },
  { title: "Profile & Support", ids: ["profile", "tickets", "faq"] },
];

const QUICK_2X2 = [
  { id: "orders", label: "My Orders", icon: "cube-outline" as const },
  { id: "wallet", label: "Wallet", icon: "wallet-outline" as const },
  { id: "wishlist", label: "Wishlist", icon: "heart-outline" as const },
  { id: "registrations", label: "Events", icon: "calendar-outline" as const },
];

function go(id: string) {
  if (id === "privacy" || id === "terms" || id === "returns" || id === "refund" || id === "shipping" || id === "cancellation") {
    router.push(`/policy/${id}` as never);
  } else if (id === "faq") {
    router.push("/faq");
  } else if (id === "seminar-videos") {
    router.push("/seminar-videos");
  } else {
    router.push(`/account/${id}` as never);
  }
}

export default function AccountScreen() {
  const { feed, loading, refresh } = useFeed();
  const { session, signOut } = useAuth();
  const wishlist = useWishlist();
  const cart = useCart();
  if (loading && !feed) return <Loading />;

  const name = session?.name || "Member";
  const byId = (id: string) => ACCOUNT_SECTIONS.find((item) => item.id === id);

  const renderRow = (item: AccountSection, last: boolean) => (
    <Pressable
      key={item.id}
      onPress={() => go(item.id)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "#F3F4F6",
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#FDF2F4", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={item.id === "wishlist" && wishlist.ids.length ? "heart" : item.icon} size={18} color={BRAND} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: TEXT, fontWeight: "700", fontSize: 14 }}>{item.title}</Text>
        <Text numberOfLines={1} style={{ color: MUTED, fontSize: 12, marginTop: 1 }}>
          {item.id === "wishlist" && wishlist.ids.length ? `${wishlist.ids.length} saved items` : item.subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FB" }}>
      <Screen refreshing={loading} onRefresh={refresh}>
        <TopBar bag compact />

        {/* Pure White Greeting + 2x2 Outlined Quick Grid */}
        <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, marginBottom: 8, borderBottomWidth: 1, borderColor: BORDER }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "800", color: TEXT }}>
                Namaste, {name}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                {session?.email || "Vaidya Gogate Memorial Foundation"}
              </Text>
            </View>
            <View style={{ backgroundColor: "#FDF2F4", borderWidth: 1, borderColor: "#F3D4D8", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: BRAND, fontSize: 11, fontWeight: "800" }}>
                {session?.accountId ? `ID ${session.accountId}` : "VGMF Account"}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
            {QUICK_2X2.map((tile) => (
              <Pressable
                key={tile.id}
                onPress={() => go(tile.id)}
                style={({ pressed }) => ({
                  width: "48.6%",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: BORDER,
                  borderRadius: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 13,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#FDF2F4", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={tile.icon} size={17} color={BRAND} />
                </View>
                <Text numberOfLines={1} style={{ color: TEXT, fontSize: 13.5, fontWeight: "700", flex: 1 }}>
                  {tile.label}
                  {tile.id === "wishlist" && wishlist.ids.length ? ` (${wishlist.ids.length})` : ""}
                </Text>
              </Pressable>
            ))}
          </View>

          {cart.count ? (
            <Pressable
              onPress={() => router.push("/cart")}
              style={{ marginTop: 12, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#BBF7D0", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="cart-outline" size={18} color="#067D62" />
                <Text style={{ color: "#067D62", fontWeight: "800", fontSize: 13 }}>
                  {cart.count} item{cart.count === 1 ? "" : "s"} in your Cart
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#067D62" />
            </Pressable>
          ) : null}
        </View>

        {/* All Account Sections */}
        {GROUPS.map((group) => {
          const items = group.ids.map(byId).filter(Boolean) as AccountSection[];
          return (
            <View key={group.title} style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, marginBottom: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER }}>
              <Text style={{ color: TEXT, fontSize: 14.5, fontWeight: "800", marginBottom: 4 }}>{group.title}</Text>
              {items.map((item, index) => renderRow(item, index === items.length - 1))}
            </View>
          );
        })}

        {/* Policies & Legal Band */}
        <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, marginBottom: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER }}>
          <Text style={{ color: TEXT, fontSize: 14.5, fontWeight: "800", marginBottom: 4 }}>Policies &amp; Legal</Text>
          {renderRow({ id: "returns", title: "Return Policy", subtitle: "Replacement and return guidelines", icon: "return-down-back-outline" }, false)}
          {renderRow({ id: "refund", title: "Refund Policy", subtitle: "Refund timelines and bank credit", icon: "cash-outline" }, false)}
          {renderRow({ id: "shipping", title: "Shipping Policy", subtitle: "Delivery charges and store pickup", icon: "cube-outline" }, false)}
          {renderRow({ id: "cancellation", title: "Cancellation Policy", subtitle: "Order cancellation rules", icon: "close-circle-outline" }, false)}
          {renderRow({ id: "privacy", title: "Privacy Policy", subtitle: "How VGMF protects your data", icon: "shield-checkmark-outline" }, false)}
          {renderRow({ id: "terms", title: "Terms of Use", subtitle: "Website and app terms", icon: "document-text-outline" }, true)}
        </View>

        <Pressable
          onPress={() => void signOut()}
          style={({ pressed }) => ({
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: BORDER,
            borderRadius: 10,
            paddingVertical: 13,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Ionicons name="log-out-outline" size={18} color={BRAND} />
          <Text style={{ color: BRAND, fontWeight: "800", fontSize: 14 }}>Sign Out</Text>
        </Pressable>

        <SiteFooter />
      </Screen>
      <ChatFab />
    </View>
  );
}
