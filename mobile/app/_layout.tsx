import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth";
import { CartProvider } from "../src/cart";
import { FeedProvider } from "../src/feed";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <FeedProvider>
      <AuthProvider>
        <CartProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerTintColor: colors.ink,
              headerStyle: { backgroundColor: colors.background },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
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
            <Stack.Screen name="notices" options={{ title: "Notice board" }} />
            <Stack.Screen name="announcements" options={{ title: "Announcements" }} />
            <Stack.Screen name="about" options={{ title: "About" }} />
            <Stack.Screen name="support" options={{ title: "Support" }} />
            <Stack.Screen name="certificates" options={{ title: "Certificates" }} />
            <Stack.Screen name="contact" options={{ title: "Contact" }} />
            <Stack.Screen name="faq" options={{ title: "FAQ" }} />
            <Stack.Screen name="cart" options={{ title: "Bag" }} />
            <Stack.Screen name="policy/[id]" options={{ title: "Policy" }} />
          </Stack>
        </CartProvider>
      </AuthProvider>
    </FeedProvider>
  );
}
