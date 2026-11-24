import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { moduleOn } from "../../src/api";
import { useFeed } from "../../src/feed";
import { currentFlavor } from "../../src/flavor";

const BRAND = "#8F2D2D";

export default function TabsLayout() {
  const flavor = currentFlavor();
  const { feed } = useFeed();
  const tabs = flavor.tabs.filter((tab) => moduleOn(feed, tab.id));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      <View style={{ flex: 1, backgroundColor: "#F8F9FB" }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: BRAND,
            tabBarInactiveTintColor: "#6B7280",
            tabBarLabelStyle: {
              fontSize: 10.5,
              fontWeight: "700",
              marginTop: 2,
              marginBottom: Platform.OS === "android" ? 6 : 0,
            },
            tabBarStyle: {
              backgroundColor: "#FFFFFF",
              borderTopColor: "#E5E7EB",
              borderTopWidth: 1,
              height: Platform.OS === "android" ? 66 : 86,
              elevation: 10,
              shadowColor: "#111827",
              shadowOpacity: 0.05,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: -2 },
              paddingTop: 6,
              paddingBottom: Platform.OS === "android" ? 6 : 20,
            },
            sceneStyle: { backgroundColor: "#F8F9FB" },
          }}
        >
          {tabs.map((tab) => (
            <Tabs.Screen
              key={tab.id}
              name={tabFile(tab.id)}
              options={{
                title: tab.title,
                tabBarIcon: ({ color, focused }) => (
                  <View style={{ minWidth: 46, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: focused ? "#FDF2F4" : "transparent" }}>
                    <Ionicons name={(focused ? tab.icon : `${tab.icon}-outline`) as never} color={color} size={20} />
                  </View>
                ),
              }}
            />
          ))}
          {hiddenFiles(tabs.map((tab) => tab.id)).map((name) => (
            <Tabs.Screen key={name} name={name} options={{ href: null }} />
          ))}
        </Tabs>
      </View>
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
