import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { registerPushToken } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Asks for permission once, then sends the device's FCM/APNs token to the server so order, publication and seminar alerts reach this phone. */
export async function registerForPush() {
  if (!Device.isDevice) return;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", { name: "Foundation updates", importance: Notifications.AndroidImportance.HIGH });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;
    const token = await Notifications.getDevicePushTokenAsync();
    if (token?.data) await registerPushToken(String(token.data), Platform.OS);
  } catch {
    // Push needs the Firebase config bundled in the build; the app works without it.
  }
}

/** Opens the screen a tapped notification points to (data.url, e.g. /order/123). */
export function listenForPushTaps() {
  const open = (response: Notifications.NotificationResponse | null) => {
    const url = String(response?.notification.request.content.data?.url ?? "");
    if (!url) return;
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    if (path.startsWith("/account/orders/")) router.push(`/order/${path.split("/").pop()}` as never);
    else if (path.startsWith("/")) router.push({ pathname: "/web", params: { path } });
  };
  void Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
