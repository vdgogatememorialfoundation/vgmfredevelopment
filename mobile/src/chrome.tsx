import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { chatOn, mediaUrl, money } from "./api";
import { useAuth } from "./auth";
import { useCart } from "./cart";
import { useDrawer } from "./drawer";
import { useBrand, useFeed } from "./feed";
import { SITE } from "./site-content";
import { BrandMark, IconButton } from "./ui";

const BRAND = "#8F2D2D";
const GREEN = "#067D62";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const PIN_KEY = "vgmf-pincode";

export function MenuButton() {
  const { openDrawer } = useDrawer();
  return <IconButton icon="menu-outline" label="Menu" onPress={openDrawer} />;
}

export function ChatFab() {
  const { feed } = useFeed();
  if (!chatOn(feed)) return null;
  return (
    <Pressable
      onPress={() => router.push("/chat")}
      accessibilityLabel="Open Foundation help chat"
      style={({ pressed }) => ({
        position: "absolute",
        right: 16,
        bottom: 18,
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#FFFFFF",
        borderWidth: 1.5,
        borderColor: BRAND,
        alignItems: "center",
        justifyContent: "center",
        elevation: 6,
        shadowColor: "#111827",
        shadowOpacity: 0.14,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        transform: [{ scale: pressed ? 0.93 : 1 }],
      })}
    >
      <Ionicons name="chatbubble-ellipses" size={22} color={BRAND} />
    </Pressable>
  );
}

/** Light, clean floating cart strip when cart has items. */
export function FloatingCartStrip() {
  const cart = useCart();
  if (!cart.count) return null;
  const total = cart.items.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
  return (
    <Pressable
      onPress={() => router.push("/cart")}
      style={({ pressed }) => ({
        position: "absolute",
        left: 14,
        right: 14,
        bottom: 12,
        backgroundColor: GREEN,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        elevation: 6,
        shadowColor: "#067D62",
        shadowOpacity: 0.22,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="cart" size={16} color="#FFFFFF" />
        </View>
        <View>
          <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>
            {cart.count} {cart.count === 1 ? "item" : "items"} · {money(total)}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 10.5, fontWeight: "600" }}>Tap to view cart &amp; checkout</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>View Cart</Text>
        <Ionicons name="chevron-forward" size={15} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

/** Pure White Modern Consumer App Bar + Light Search Bar + Delivery Pincode Row (Zero dark colors). */
export function TopBar({ bag = false, compact = false }: { bag?: boolean; compact?: boolean }) {
  const brand = useBrand();
  const { session } = useAuth();
  const cart = useCart();
  const { openDrawer } = useDrawer();
  const [pincode, setPincode] = useState("411009");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void SecureStore.getItemAsync(PIN_KEY)
      .then((value) => {
        if (value) setPincode(value);
      })
      .catch(() => undefined);
  }, []);

  const savePin = (value: string) => {
    const pin = value.replace(/\D/g, "").slice(0, 6);
    setPincode(pin);
    if (pin.length === 6) {
      setEditing(false);
      void SecureStore.setItemAsync(PIN_KEY, pin).catch(() => undefined);
    }
  };

  return (
    <View style={{ marginHorizontal: -20, marginTop: -8, marginBottom: 8, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: BORDER }}>
      <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: compact ? 10 : 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <Pressable
            onPress={openDrawer}
            accessibilityLabel="Menu"
            hitSlop={8}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "#F8F9FB",
              borderWidth: 1,
              borderColor: BORDER,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Ionicons name="menu" size={20} color={TEXT} />
          </Pressable>

          <BrandMark uri={mediaUrl(brand.logoUrl) || undefined} name={brand.name} size={32} />

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT, letterSpacing: -0.2 }} numberOfLines={1}>
                {SITE.shortName}
              </Text>
              <View style={{ backgroundColor: "#FDF2F4", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1.5 }}>
                <Text style={{ fontSize: 9.5, fontWeight: "800", color: BRAND }}>Official</Text>
              </View>
            </View>
            <Text style={{ fontSize: 10.5, fontWeight: "600", color: MUTED }} numberOfLines={1}>
              {SITE.name}
            </Text>
          </View>

          <HeaderIcon icon="notifications-outline" label="Notifications" onPress={() => router.push("/account/notifications")} />
          {bag ? <HeaderIcon icon="cart-outline" label="Cart" badge={cart.count} onPress={() => router.push("/cart")} /> : null}
          <HeaderIcon icon={session ? "person-circle-outline" : "person-outline"} label="Account" onPress={() => router.push("/account")} />
        </View>

        {!compact ? (
          <Pressable
            onPress={() => router.push("/search")}
            accessibilityRole="search"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: "#F8F9FB",
              borderWidth: 1,
              borderColor: BORDER,
              borderRadius: 12,
              paddingHorizontal: 12,
              height: 42,
              marginTop: 11,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Ionicons name="search" size={17} color={BRAND} />
            <Text style={{ color: MUTED, fontSize: 13.5, fontWeight: "500", flex: 1 }} numberOfLines={1}>
              Search Books, Seminars, Clinics, Articles…
            </Text>
            <Ionicons name="options-outline" size={16} color={MUTED} />
          </Pressable>
        ) : null}
      </View>

      {!compact ? (
        <View
          style={{
            backgroundColor: "#FFFFFF",
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderTopWidth: 1,
            borderTopColor: "#F3F4F6",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
            <Ionicons name="location-outline" size={15} color={BRAND} />
            {editing ? (
              <TextInput
                autoFocus
                value={pincode}
                onChangeText={savePin}
                onBlur={() => setEditing(false)}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="Enter 6-digit pincode"
                placeholderTextColor={MUTED}
                style={{ color: TEXT, fontSize: 12.5, fontWeight: "700", paddingVertical: 0, flex: 1 }}
              />
            ) : (
              <Text onPress={() => setEditing(true)} style={{ color: MUTED, fontSize: 12.5, fontWeight: "500", flex: 1 }} numberOfLines={1}>
                Deliver to <Text style={{ fontWeight: "800", color: TEXT }}>{pincode.length === 6 ? pincode : "Select pincode"}</Text>
              </Text>
            )}
          </View>
          <Pressable onPress={() => setEditing(true)} hitSlop={8}>
            <Text style={{ color: BRAND, fontSize: 12, fontWeight: "800" }}>{pincode ? "Change" : "Add"}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function HeaderIcon({ icon, label, onPress, badge }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={badge ? `${label} ${badge}` : label}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "#F8F9FB",
        borderWidth: 1,
        borderColor: BORDER,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={TEXT} />
      {badge ? (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            backgroundColor: BRAND,
            borderWidth: 1.5,
            borderColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 9.5, fontWeight: "900" }}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function GoldBanner({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <View
      style={{
        backgroundColor: "#FDF2F4",
        marginHorizontal: -20,
        marginTop: -8,
        marginBottom: 16,
        paddingHorizontal: 18,
        paddingVertical: 11,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: "#F3D4D8",
      }}
    >
      <Text style={{ color: BRAND, fontSize: 12.5, fontWeight: "700", flex: 1 }}>{text}</Text>
      {action && onAction ? (
        <Text onPress={onAction} style={{ color: BRAND, fontSize: 12, fontWeight: "800" }}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}
