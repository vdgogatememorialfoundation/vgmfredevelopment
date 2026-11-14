import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { chatOn, mediaUrl } from "./api";
import { useAuth } from "./auth";
import { useCart } from "./cart";
import { useDrawer } from "./drawer";
import { useBrand, useFeed } from "./feed";
import { SITE } from "./site-content";
import { useTheme } from "./theme";
import { BrandMark, IconButton } from "./ui";

export function MenuButton() {
  const { openDrawer } = useDrawer();
  return <IconButton icon="menu-outline" label="Menu" onPress={openDrawer} />;
}

export function ChatFab() {
  const theme = useTheme();
  const { feed } = useFeed();
  if (!chatOn(feed)) return null;
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
  const { feed } = useFeed();
  const { openDrawer } = useDrawer();
  const [pincode, setPincode] = useState("");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    void SecureStore.getItemAsync(PIN_KEY).then((value) => setPincode(value || "")).catch(() => undefined);
  }, []);
  const savePin = (value: string) => {
    const pin = value.replace(/\D/g, "").slice(0, 6);
    setPincode(pin);
    if (pin.length === 6) {
      setEditing(false);
      void SecureStore.setItemAsync(PIN_KEY, pin).catch(() => undefined);
    }
  };
  const white = theme.colors.onPrimary;
  return (
    <View style={{ backgroundColor: theme.colors.primary, marginHorizontal: -20, marginTop: -8, marginBottom: 16, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Pressable onPress={openDrawer} accessibilityLabel="Menu" style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="menu" size={24} color={white} />
        </Pressable>
        <View style={{ backgroundColor: white, borderRadius: 10, padding: 2 }}>
          <BrandMark uri={mediaUrl(brand.logoUrl) || undefined} name={brand.name} size={30} />
        </View>
        <View style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: white, letterSpacing: 0.2 }} numberOfLines={1}>{SITE.name}</Text>
          <Text style={{ fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.8)" }} numberOfLines={1}>{SITE.nativeName}</Text>
        </View>
        <HeaderIcon icon="notifications-outline" label="Notifications" onPress={() => router.push("/account/notifications")} />
        {chatOn(feed) ? <HeaderIcon icon="chatbubbles-outline" label="Chat" onPress={() => router.push("/chat")} /> : null}
        {bag ? <HeaderIcon icon="bag-handle-outline" label="Cart" badge={cart.count} onPress={() => router.push("/cart")} /> : null}
        <HeaderIcon icon={session ? "person-circle" : "person-outline"} label="Account" onPress={() => router.push("/account")} />
      </View>
      <Pressable onPress={() => router.push("/search")} accessibilityRole="search" style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: white, borderRadius: 12, paddingHorizontal: 14, height: 44, marginTop: 12 }}>
        <Ionicons name="search" size={18} color={theme.colors.muted} />
        <Text style={{ color: theme.colors.muted, fontSize: 14, flex: 1 }} numberOfLines={1}>Search books, articles, events…</Text>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
        <Ionicons name="location-outline" size={15} color={white} />
        {editing ? (
          <TextInput
            autoFocus
            value={pincode}
            onChangeText={savePin}
            onBlur={() => setEditing(false)}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="Enter 6-digit pincode"
            placeholderTextColor="rgba(255,255,255,0.7)"
            style={{ color: white, fontSize: 13, fontWeight: "700", paddingVertical: 0, flex: 1 }}
          />
        ) : (
          <Text onPress={() => setEditing(true)} style={{ color: white, fontSize: 13, fontWeight: "600", flex: 1 }} numberOfLines={1}>
            {pincode.length === 6 ? `Delivering to ${pincode}` : "Set delivery pincode"}  <Text style={{ fontWeight: "800", textDecorationLine: "underline" }}>{pincode ? "Change" : "Add"}</Text>
          </Text>
        )}
      </View>
    </View>
  );
}

const PIN_KEY = "vgmf-pincode";

function HeaderIcon({ icon, label, onPress, badge }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; badge?: number }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel={badge ? `${label} ${badge}` : label} accessibilityRole="button" style={({ pressed }) => [{ width: 36, height: 36, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={22} color={theme.colors.onPrimary} />
      {badge ? (
        <View style={{ position: "absolute", top: 1, right: 1, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: theme.colors.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "800" }}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
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
