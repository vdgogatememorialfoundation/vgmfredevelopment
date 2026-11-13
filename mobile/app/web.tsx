import { useState } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import { getApiBase } from "../src/api";
import { useTheme } from "../src/theme";

/** Any website page without its own native screen opens here, inside the app. */
export default function WebPageScreen() {
  const { path, title } = useLocalSearchParams<{ path?: string; title?: string }>();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const base = getApiBase().replace(/\/$/, "");
  const target = String(path || "/").startsWith("/") ? String(path || "/") : `/${path}`;
  const host = base.replace(/^https?:\/\//, "");
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack.Screen options={{ title: String(title || "Foundation") }} />
      <WebView
        source={{ uri: `${base}${target}${target.includes("?") ? "&" : "?"}app=1` }}
        onLoadEnd={() => setLoading(false)}
        sharedCookiesEnabled
        onShouldStartLoadWithRequest={(request) => {
          const url = request.url;
          if (/^(tel:|mailto:|whatsapp:|upi:|intent:)/i.test(url)) {
            void Linking.openURL(url).catch(() => undefined);
            return false;
          }
          if (/^https?:\/\//i.test(url) && !url.includes(host) && request.isTopFrame) {
            void Linking.openURL(url).catch(() => undefined);
            return false;
          }
          return true;
        }}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      />
      {loading ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}
    </View>
  );
}
