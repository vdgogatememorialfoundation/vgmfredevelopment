import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { moduleOn } from "../../src/api";
import { useFeed } from "../../src/feed";
import { currentFlavor } from "../../src/flavor";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  const flavor = currentFlavor();
  const { feed } = useFeed();
  const tabs = flavor.tabs.filter((tab) => moduleOn(feed, tab.id));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.burgundy,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.id}
          name={tabFile(tab.id)}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon as never} color={color} size={size} />,
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
  const all = ["index", "events", "shop", "clinics", "account", "support", "notices", "certificates"];
  const shown = visible.map(tabFile);
  return all.filter((name) => !shown.includes(name));
}
