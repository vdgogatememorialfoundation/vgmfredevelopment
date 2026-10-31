import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { mediaUrl } from "./api";
import { useAuth } from "./auth";
import { useCart } from "./cart";
import { useBrand } from "./feed";
import { SITE } from "./site-content";
import { useTheme } from "./theme";
import { BrandMark } from "./ui";

type DrawerItem = { href: string; label: string; icon: keyof typeof Ionicons.glyphMap };

const MENU: { title: string; items: DrawerItem[] }[] = [
  {
    title: "Foundation",
    items: [
      { href: "/", label: "Home", icon: "home-outline" },
      { href: "/about", label: "About", icon: "people-outline" },
      { href: "/events", label: "Events", icon: "calendar-outline" },
      { href: "/gallery", label: "Gallery", icon: "images-outline" },
      { href: "/videos", label: "Videos", icon: "play-circle-outline" },
      { href: "/articles", label: "Articles", icon: "newspaper-outline" },
      { href: "/notices", label: "Notices", icon: "notifications-outline" },
    ],
  },
  {
    title: "Services",
    items: [
      { href: "/shop", label: "Shop", icon: "bag-handle-outline" },
      { href: "/clinics", label: "Clinics", icon: "medical-outline" },
      { href: "/certificates", label: "Certificates", icon: "ribbon-outline" },
      { href: "/contact", label: "Contact", icon: "mail-outline" },
      { href: "/chat", label: "Chat", icon: "chatbubbles-outline" },
      { href: "/faq", label: "FAQ", icon: "help-circle-outline" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/cart", label: "Bag", icon: "basket-outline" },
      { href: "/account", label: "My account", icon: "person-circle-outline" },
      { href: "/support", label: "Go to my tickets", icon: "help-buoy-outline" },
      { href: "/checkout", label: "Checkout", icon: "card-outline" },
    ],
  },
];

type DrawerValue = {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

const DrawerContext = createContext<DrawerValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo<DrawerValue>(
    () => ({
      open,
      openDrawer: () => setOpen(true),
      closeDrawer: () => setOpen(false),
      toggleDrawer: () => setOpen((current) => !current),
    }),
    [open]
  );
  return (
    <DrawerContext.Provider value={value}>
      {children}
      <AppDrawer />
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const value = useContext(DrawerContext);
  if (!value) throw new Error("DrawerProvider missing");
  return value;
}

export function AppDrawer() {
  const theme = useTheme();
  const brand = useBrand();
  const { session, signOut } = useAuth();
  const cart = useCart();
  const { open, closeDrawer } = useDrawer();

  const go = (href: string) => {
    closeDrawer();
    router.push(href as never);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={closeDrawer}>
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: "rgba(11,31,58,0.35)" }}>
        <SafeAreaView style={{ width: "84%", maxWidth: 360, backgroundColor: theme.colors.background }} edges={["top", "bottom"]}>
          <View style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <BrandMark uri={mediaUrl(brand.logoUrl) || undefined} name={brand.name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.primary, fontWeight: "800", fontFamily: theme.fontFamily, fontSize: 16 }}>{SITE.shortName} Foundation</Text>
              <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                {session?.name || SITE.nativeName}
              </Text>
              {session?.accountId ? <Text style={{ color: theme.colors.primary, fontSize: 11, fontWeight: "700", marginTop: 2 }}>ID {session.accountId}</Text> : null}
            </View>
            <Pressable onPress={closeDrawer} hitSlop={10} accessibilityLabel="Close menu">
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            {MENU.map((section) => (
              <View key={section.title} style={{ marginBottom: 18 }}>
                <Text style={{ color: theme.colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8 }}>{section.title}</Text>
                {section.items.map((item) => (
                  <Pressable
                    key={item.href}
                    onPress={() => go(item.href)}
                    style={({ pressed }) => [{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 11,
                      paddingHorizontal: 10,
                      borderRadius: 12,
                      backgroundColor: pressed ? theme.colors.paper : "transparent",
                    }]}
                  >
                    <Ionicons name={item.icon} size={18} color={theme.colors.primary} />
                    <Text style={{ flex: 1, color: theme.colors.text, fontWeight: "600", fontSize: 15 }}>{item.label}</Text>
                    {item.href === "/cart" && cart.count ? (
                      <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
                        <Text style={{ color: theme.colors.onPrimary, fontSize: 10, fontWeight: "800" }}>{cart.count}</Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={14} color={theme.colors.muted} />
                    )}
                  </Pressable>
                ))}
              </View>
            ))}
            <Pressable
              onPress={async () => {
                closeDrawer();
                await signOut();
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 10 }}
            >
              <Ionicons name="log-out-outline" size={18} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Sign out</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
        <Pressable style={{ flex: 1 }} onPress={closeDrawer} accessibilityLabel="Close menu" />
      </View>
    </Modal>
  );
}
