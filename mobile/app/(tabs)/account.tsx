import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ACCOUNT_SECTIONS, type AccountSection } from "../../src/account-nav";
import { useAuth } from "../../src/auth";
import { useCart } from "../../src/cart";
import { ChatFab, TopBar } from "../../src/chrome";
import { useFeed } from "../../src/feed";
import { useTheme } from "../../src/theme";
import { useWishlist } from "../../src/wishlist";
import { Button, Loading, Screen, SiteFooter } from "../../src/ui";

const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Foundation", ids: ["registrations", "applications", "notifications", "subscriptions"] },
  { title: "Orders & payments", ids: ["orders", "payments", "receipts", "wishlist", "cards", "addresses", "loyalty"] },
  { title: "Help & profile", ids: ["tickets", "faq", "profile"] },
];

const QUICK = [
  { id: "orders", label: "Orders", icon: "cube-outline" },
  { id: "registrations", label: "Registrations", icon: "calendar-outline" },
  { id: "wishlist", label: "Wishlist", icon: "heart-outline" },
  { id: "tickets", label: "Support", icon: "help-buoy-outline" },
] as const;

function go(id: string) {
  if (id === "privacy" || id === "terms") router.push(`/policy/${id}`);
  else router.push(id === "faq" ? "/faq" : `/account/${id}`);
}

export default function AccountScreen() {
  const theme = useTheme();
  const { feed, loading, refresh } = useFeed();
  const { session, signOut } = useAuth();
  const wishlist = useWishlist();
  const cart = useCart();
  if (loading && !feed) return <Loading />;
  const name = session?.name || "Member";
  const initials = name.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const byId = (id: string) => ACCOUNT_SECTIONS.find((item) => item.id === id);

  const row = (item: AccountSection, last: boolean) => (
    <Pressable
      key={item.id}
      onPress={() => go(item.id)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.colors.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={item.id === "wishlist" && wishlist.ids.length ? "heart" : item.icon} size={18} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: theme.colors.text, fontWeight: "700", fontSize: 14 }}>{item.title}</Text>
        <Text numberOfLines={1} style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2 }}>
          {item.id === "wishlist" && wishlist.ids.length ? `${wishlist.ids.length} saved` : item.subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={loading} onRefresh={refresh}>
        <TopBar bag />
        <View style={{ backgroundColor: theme.colors.primary, borderRadius: 22, padding: 18, marginBottom: 16, overflow: "hidden" }}>
          <View style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.07)" }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: theme.colors.paper, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: theme.colors.accent }}>
              <Text style={{ color: theme.colors.primary, fontWeight: "800", fontSize: 20 }}>{initials || "VG"}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: theme.colors.onPrimary, fontWeight: "800", fontSize: 19, fontFamily: theme.fontFamily }}>{name}</Text>
              {session?.email ? <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 }}>{session.email}</Text> : null}
              <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "800", marginTop: 4 }}>
                {session?.accountId ? `Account ID ${session.accountId}` : "Account ID appears after first verified sign-in"}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          {QUICK.map((tile) => (
            <Pressable
              key={tile.id}
              onPress={() => go(tile.id)}
              accessibilityRole="button"
              accessibilityLabel={tile.label}
              style={({ pressed }) => [{ flex: 1, backgroundColor: theme.colors.paper, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 14, alignItems: "center", gap: 6, opacity: pressed ? 0.85 : 1 }]}
            >
              <Ionicons name={tile.icon} size={22} color={theme.colors.primary} />
              <Text numberOfLines={1} style={{ color: theme.colors.text, fontSize: 11, fontWeight: "700" }}>{tile.label}</Text>
              {tile.id === "wishlist" && wishlist.ids.length ? <Text style={{ color: theme.colors.primary, fontSize: 11, fontWeight: "800" }}>{wishlist.ids.length}</Text> : null}
            </Pressable>
          ))}
        </View>

        {cart.count ? <Button kind="soft" icon="bag-handle-outline" label={`Bag · ${cart.count} item${cart.count === 1 ? "" : "s"}`} onPress={() => router.push("/cart")} /> : null}
        <View style={{ height: 8 }} />

        {GROUPS.map((group) => {
          const items = group.ids.map(byId).filter(Boolean) as AccountSection[];
          return (
            <View key={group.title} style={{ marginBottom: 16 }}>
              <Text style={{ color: theme.colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginLeft: 4 }}>{group.title}</Text>
              <View style={{ backgroundColor: theme.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14 }}>
                {items.map((item, index) => row(item, index === items.length - 1))}
              </View>
            </View>
          );
        })}

        <View style={{ backgroundColor: theme.colors.paper, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, marginBottom: 8 }}>
          {row({ id: "privacy", title: "Privacy policy", subtitle: "How the Foundation handles your data", icon: "shield-checkmark-outline" }, false)}
          {row({ id: "terms", title: "Terms of use", subtitle: "Terms for the website and app", icon: "document-text-outline" }, true)}
        </View>
        <Button kind="ghost" icon="log-out-outline" label="Sign out" onPress={() => void signOut()} />
        <SiteFooter />
      </Screen>
      <ChatFab />
    </View>
  );
}
