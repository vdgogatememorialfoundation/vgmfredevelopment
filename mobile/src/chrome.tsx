import { Text, View } from "react-native";
import { router } from "expo-router";
import { mediaUrl } from "./api";
import { useAuth } from "./auth";
import { useCart } from "./cart";
import { useBrand } from "./feed";
import { SITE } from "./site-content";
import { useTheme } from "./theme";
import { BrandMark, IconButton } from "./ui";

export function TopBar({ bag = false }: { bag?: boolean }) {
  const theme = useTheme();
  const brand = useBrand();
  const { session } = useAuth();
  const cart = useCart();
  return (
    <View style={{ paddingBottom: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <BrandMark uri={mediaUrl(brand.logoUrl) || undefined} name={brand.name} size={34} />
        <Text style={{ flex: 1, fontSize: 18, fontWeight: "700", color: theme.colors.text, fontFamily: theme.fontFamily }} numberOfLines={1}>
          {SITE.shortName} Foundation
        </Text>
        {bag ? <IconButton icon="bag-handle-outline" label="Bag" badge={cart.count} onPress={() => router.push("/cart")} /> : null}
        <IconButton icon={session ? "person-circle" : "notifications-outline"} label="Account" onPress={() => router.push("/account")} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
          English  ·  {SITE.greeting}
        </Text>
        <View style={{ backgroundColor: theme.colors.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: theme.colors.onPrimary, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 }}>{SITE.liveLabel.toUpperCase()}</Text>
        </View>
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
