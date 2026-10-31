import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/auth";
import { CartProvider } from "../src/cart";
import { MenuButton } from "../src/chrome";
import { DrawerProvider } from "../src/drawer";
import { FeedProvider } from "../src/feed";
import { ThemeProvider, useTheme } from "../src/theme";
import { Loading } from "../src/ui";
import { WishlistProvider } from "../src/wishlist";
import LoginScreen from "./login";

function ThemedStack() {
  const theme = useTheme();
  const { session, ready } = useAuth();
  if (!ready) return <Loading label="Opening VGMF…" />;
  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top", "bottom"]}>
        <StatusBar style="dark" backgroundColor={theme.colors.background} />
        <LoginScreen />
      </SafeAreaView>
    );
  }
  return (
    <>
      <StatusBar style="dark" backgroundColor={theme.colors.background} />
      <Stack
        screenOptions={{
          headerTintColor: theme.colors.text,
          headerStyle: { backgroundColor: theme.colors.background },
          headerTitleStyle: { fontWeight: "700", fontSize: 17, color: theme.colors.text },
          headerBackTitle: "Back",
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
          headerRight: () => <MenuButton />,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ title: "Event" }} />
        <Stack.Screen name="article/[id]" options={{ title: "Article" }} />
        <Stack.Screen name="book/[id]" options={{ title: "Publication" }} />
        <Stack.Screen name="clinic/[id]" options={{ title: "Clinic" }} />
        <Stack.Screen name="articles" options={{ title: "Articles" }} />
        <Stack.Screen name="videos" options={{ title: "Videos" }} />
        <Stack.Screen name="gallery" options={{ title: "Gallery" }} />
        <Stack.Screen name="notices" options={{ headerShown: false }} />
        <Stack.Screen name="announcements" options={{ title: "Announcements" }} />
        <Stack.Screen name="about" options={{ title: "About" }} />
        <Stack.Screen name="support" options={{ title: "Support" }} />
        <Stack.Screen name="certificates" options={{ title: "Certificates" }} />
        <Stack.Screen name="contact" options={{ title: "Contact" }} />
        <Stack.Screen name="faq" options={{ title: "FAQ" }} />
        <Stack.Screen name="cart" options={{ title: "Cart" }} />
        <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
        <Stack.Screen name="account/[section]" options={{ title: "My Account" }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="policy/[id]" options={{ title: "Policy" }} />
        <Stack.Screen name="search" options={{ title: "Search" }} />
        <Stack.Screen name="chat" options={{ title: "Chat" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <FeedProvider>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <DrawerProvider>
                <ThemedStack />
              </DrawerProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </FeedProvider>
  );
}
