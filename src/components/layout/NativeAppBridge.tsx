"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

type PushPlugin = {
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  createChannel?: (channel: { id: string; name: string; importance: number; sound?: string }) => Promise<void>;
  addListener: (event: string, handler: (payload: never) => void) => Promise<unknown> | unknown;
};
type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: { PushNotifications?: PushPlugin } };

const TOKEN_KEY = "vgmf_push_token";

function native() {
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.isNativePlatform?.() ? cap : null;
}

function sendToken(token: string, platform: string) {
  void fetch("/api/push/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, platform }),
  }).catch(() => undefined);
}

/** Inside the Android / iOS app: registers for Firebase push and opens the tapped notification's page in the app. */
export default function NativeAppBridge() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const cap = native();
    const push = cap?.Plugins?.PushNotifications;
    if (!cap || !push) return;
    const platform = cap.getPlatform?.() ?? "native";
    void push.addListener("registration", ((token: { value: string }) => {
      window.localStorage.setItem(TOKEN_KEY, token.value);
      sendToken(token.value, platform);
    }) as (payload: never) => void);
    void push.addListener("pushNotificationActionPerformed", ((action: { notification?: { data?: { url?: string } } }) => {
      const url = action.notification?.data?.url;
      if (url && url.startsWith("/")) router.push(url);
    }) as (payload: never) => void);
    void push.createChannel?.({ id: "orders", name: "Order updates", importance: 5, sound: "default" }).catch(() => undefined);
    void push
      .requestPermissions()
      .then((result) => (result.receive === "granted" ? push.register() : undefined))
      .catch(() => undefined);
  }, [router]);

  // Re-link the device after sign-in / sign-out so notifications follow the account.
  useEffect(() => {
    const cap = native();
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (cap && token) sendToken(token, cap.getPlatform?.() ?? "native");
  }, [pathname]);

  return null;
}
