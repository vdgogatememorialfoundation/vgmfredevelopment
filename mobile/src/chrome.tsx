import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { mediaUrl } from "./api";
import { useAuth } from "./auth";
import { useCart } from "./cart";
import { useDrawer } from "./drawer";
import { useBrand } from "./feed";
import { SITE } from "./site-content";
import { useTheme } from "./theme";
import { BrandMark, IconButton } from "./ui";

export function MenuButton() {
  const { openDrawer } = useDrawer();
  return <IconButton icon="menu-outline" label="Menu" onPress={openDrawer} />;
}

export function ChatFab() {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push("/chat")}
      accessibilityLabel="Open Foundation chat"
      style={{
        position: "absolute",
        right: 18,
        bottom: 18,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.colors.primary,
        alignItems: "center",
        justifyContent: "center",
        elevation: 4,
        shadowColor: "#0B1F3A",
        shadowOpacity: 0.2,
        shadowRadius: 8,
      }}
    >
      <Ionicons name="chatbubbles" size={22} color={theme.colors.onPrimary} />
    </Pressable>
  );
}

export function TopBar({ bag = false }: { bag?: boolean }) {
  const theme = useTheme();
  const brand = useBrand();
  const { session } = useAuth();
  const cart = useCart();
  return (
    <View style={{ paddingBottom: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <MenuButton />
        <BrandMark uri={mediaUrl(brand.logoUrl) || undefined} name={brand.name} size={34} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: theme.colors.text, fontFamily: theme.fontFamily }} numberOfLines={2}>
          {SITE.name}
        </Text>
        <IconButton icon="chatbubbles-outline" label="Chat" onPress={() => router.push("/chat")} />
        {bag ? <IconButton icon="bag-handle-outline" label="Cart" badge={cart.count} onPress={() => router.push("/cart")} /> : null}
        <IconButton icon={session ? "person-circle" : "notifications-outline"} label="Account" onPress={() => router.push("/account")} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
          English  ·  {SITE.greeting}
        </Text>
      </View>
    </View>
  );
}

export function GoldBanner({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ backgroundColor: "#8A6A2A", marginHorizontal: -20, marginTop: -8, marginBottom: 16, paddingHorizontal: 20, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ color: "#FFF8E7", fontSize: 12, fontWeight: "600", flex: 1 }}>{text}</Text>
      {action && onAction ? (
        <Text onPress={onAction} style={{ color: "#FFF8E7", fontSize: 11, fontWeight: "800", letterSpacing: 0.6 }}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}
