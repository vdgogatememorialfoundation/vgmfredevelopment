import type { CapacitorConfig } from "@capacitor/cli";

// The app shows the live Foundation site, so every page, product, article and admin change appears without an app update.
const siteUrl = process.env.CAP_SERVER_URL || "https://staging.vaidyagogate.org";

const config: CapacitorConfig = {
  appId: "org.vaidyagogate.customer",
  appName: "Vaidya Gogate Memorial Foundation",
  webDir: "www",
  server: {
    url: siteUrl,
    // Pages on these hosts stay inside the app; any other link (e.g. seminar / event registration sites) opens in the phone's browser.
    allowNavigation: ["vaidyagogate.org", "www.vaidyagogate.org", "staging.vaidyagogate.org", "demo.vaidyagogate.org", "api.razorpay.com", "checkout.razorpay.com", "accounts.google.com"],
    errorPath: "offline.html",
  },
  android: { allowMixedContent: false },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
    SplashScreen: { launchShowDuration: 1200, backgroundColor: "#7a1f2b", showSpinner: false },
  },
};

export default config;
