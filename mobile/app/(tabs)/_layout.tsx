import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { moduleOn } from "../../src/api";
import { useFeed } from "../../src/feed";
import { currentFlavor } from "../../src/flavor";
import { useTheme } from "../../src/theme";

export default function TabsLayout() {
  const flavor = currentFlavor();
  const { feed } = useFeed();
  const theme = useTheme();
  const tabs = flavor.tabs.filter((tab) => moduleOn(feed, tab.id));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.muted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, marginBottom: Platform.OS === "android" ? 4 : 0 },
          tabBarStyle: {
            backgroundColor: theme.colors.paper,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            height: Platform.OS === "android" ? 68 : 88,
            elevation: 12,
            shadowColor: "#3B2A14",
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: -3 },
            paddingTop: 6,
            paddingBottom: Platform.OS === "android" ? 8 : 20,
          },
          sceneStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen
            key={tab.id}
            name={tabFile(tab.id)}
            options={{
              title: tab.title,
              tabBarIcon: ({ color, focused }) => (
                <View style={{ minWidth: 48, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: focused ? "#F3E6E1" : "transparent" }}>
                  <Ionicons name={(focused ? tab.icon : `${tab.icon}-outline`) as never} color={color} size={22} />
                </View>
              ),
            }}
          />
        ))}
        {hiddenFiles(tabs.map((tab) => tab.id)).map((name) => (
          <Tabs.Screen key={name} name={name} options={{ href: null }} />
        ))}
      </Tabs>
    </SafeAreaView>
  );
}

function tabFile(id: string) {
  if (id === "home") return "index";
  return id;
}

function hiddenFiles(visible: string[]) {
  const all = ["index", "articles", "events", "shop", "clinics", "account", "support", "certificates"];
  const shown = visible.map(tabFile);
  return all.filter((name) => !shown.includes(name));
}
