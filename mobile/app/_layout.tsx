import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth";
import { CartProvider } from "../src/cart";
import { FeedProvider } from "../src/feed";
import { ThemeProvider, useTheme } from "../src/theme";

function ThemedStack() {
  const theme = useTheme();
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
        <Stack.Screen name="cart" options={{ title: "Bag" }} />
        <Stack.Screen name="policy/[id]" options={{ title: "Policy" }} />
        <Stack.Screen name="search" options={{ title: "Search" }} />
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
            <ThemedStack />
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </FeedProvider>
  );
}
