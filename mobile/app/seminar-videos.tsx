import { useCallback, useEffect, useState } from "react";
import { Linking, Modal, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import WebView from "react-native-webview";
import { getApiBase, mediaUrl, money, str } from "../src/api";
import { useAuth } from "../src/auth";
import { useFeed } from "../src/feed";
import { Cover, Empty, Loading, Screen, SiteFooter } from "../src/ui";

const BRAND = "#8F2D2D";
const GREEN = "#067D62";
const PURPLE = "#6D28D9";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

type SeminarVideoItem = {
  id: number;
  year: number;
  title: string;
  description?: string;
  durationSec?: number | null;
  priceInr?: number;
  access?: { allowed?: boolean; reason?: string | null };
};

type SeminarYearGroup = {
  year: number;
  title: string;
  description?: string;
  allAllowed?: boolean;
  bundlePriceInr?: number | null;
  videos?: SeminarVideoItem[];
};

function fmtDuration(sec?: number | null) {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m} min`;
}

export default function SeminarVideosScreen() {
  const { session } = useAuth();
  const { feed, refresh } = useFeed();
  const [years, setYears] = useState<SeminarYearGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerOpen, setPlayerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { accept: "application/json" };
      if (session?.token) headers.authorization = `Bearer ${session.token}`;
      const res = await fetch(`${getApiBase()}/api/seminar-videos`, { headers });
      if (res.ok) {
        const data = (await res.json()) as { years?: SeminarYearGroup[] };
        setYears(Array.isArray(data.years) ? data.years : []);
      }
    } catch {
      /* keep fallback */
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    void load();
  }, [load]);

  const publicVideos = feed?.videos ?? [];
  const webLibraryUrl = `${getApiBase()}/account/seminar-videos`;

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FB" }}>
      <Screen refreshing={loading} onRefresh={() => { void load(); void refresh(); }}>
        {/* Pure White Header Band */}
        <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, marginTop: -8, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 8, borderBottomWidth: 1, borderColor: BORDER }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="play-circle" size={24} color={PURPLE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 19, fontWeight: "800", color: TEXT }}>Seminar Videos</Text>
              <Text style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>
                Recorded national seminar lectures, sessions &amp; Foundation talks
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setPlayerOpen(true)}
            style={({ pressed }) => ({
              marginTop: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: BRAND,
              borderRadius: 10,
              paddingVertical: 12,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Ionicons name="play" size={16} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "800" }}>Open Seminar Video Player</Text>
          </Pressable>
        </View>

        {loading && !years.length ? <Loading label="Loading seminar videos…" /> : null}

        {years.map((group) => (
          <View
            key={group.year}
            style={{
              backgroundColor: "#FFFFFF",
              marginHorizontal: -20,
              paddingHorizontal: 16,
              paddingVertical: 14,
              marginBottom: 8,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: BORDER,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ fontSize: 15.5, fontWeight: "800", color: TEXT }}>{group.title || `Seminar ${group.year}`}</Text>
                {group.description ? <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{group.description}</Text> : null}
              </View>
              {group.allAllowed ? (
                <View style={{ backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#BBF7D0", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: "800", color: GREEN }}>Unlocked</Text>
                </View>
              ) : group.bundlePriceInr ? (
                <View style={{ backgroundColor: "#FDF2F4", borderWidth: 1, borderColor: "#F3D4D8", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: "800", color: BRAND }}>{money(group.bundlePriceInr)}</Text>
                </View>
              ) : null}
            </View>

            {(group.videos ?? []).map((video, index) => {
              const unlocked = Boolean(group.allAllowed || video.access?.allowed);
              const dur = fmtDuration(video.durationSec);
              return (
                <Pressable
                  key={video.id}
                  onPress={() => setPlayerOpen(true)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 11,
                    borderTopWidth: index ? 1 : 0,
                    borderTopColor: "#F3F4F6",
                    opacity: pressed ? 0.78 : 1,
                  })}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: unlocked ? "#ECFDF5" : "#F5F3FF", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={unlocked ? "play" : "lock-closed-outline"} size={18} color={unlocked ? GREEN : PURPLE} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={2} style={{ fontSize: 13.5, fontWeight: "700", color: TEXT }}>{video.title}</Text>
                    <Text style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>
                      {[dur, unlocked ? "Ready to watch" : video.priceInr ? money(video.priceInr) : "Seminar access"].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* Public Foundation Videos */}
        {publicVideos.length ? (
          <View style={{ backgroundColor: "#FFFFFF", marginHorizontal: -20, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT, marginBottom: 10 }}>Foundation Talks &amp; Public Videos</Text>
            {publicVideos.map((item) => {
              const url = str(item.youtubeUrl, str(item.src));
              return (
                <Pressable
                  key={str(item.id)}
                  onPress={() => url && void Linking.openURL(url)}
                  style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, marginBottom: 10 }}
                >
                  <Cover uri={mediaUrl(item.poster) || undefined} height={150} />
                  <Text style={{ fontSize: 14.5, fontWeight: "800", color: TEXT }}>{str(item.title)}</Text>
                  {str(item.description) ? <Text style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>{str(item.description)}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!loading && !years.length && !publicVideos.length ? (
          <View style={{ marginTop: 8 }}>
            <Empty
              icon="play-circle-outline"
              label="Sign in or open the Seminar Video Player to watch recorded seminar sessions linked to your Foundation account."
              actionLabel="Open Seminar Video Player"
              onAction={() => setPlayerOpen(true)}
            />
          </View>
        ) : null}

        <SiteFooter />
      </Screen>

      {/* Secure In-App Seminar Video Player Modal (Watermarked HLS Stream) */}
      <Modal visible={playerOpen} animationType="slide" onRequestClose={() => setPlayerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#FFFFFF", paddingTop: 36 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderColor: BORDER }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT }}>Seminar Video Library</Text>
            <Pressable
              onPress={() => setPlayerOpen(false)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FDF2F4", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
            >
              <Ionicons name="close" size={16} color={BRAND} />
              <Text style={{ color: BRAND, fontWeight: "800", fontSize: 12.5 }}>Close</Text>
            </Pressable>
          </View>
          <WebView source={{ uri: webLibraryUrl }} javaScriptEnabled allowsFullscreenVideo mediaPlaybackRequiresUserAction={false} style={{ flex: 1 }} />
        </View>
      </Modal>
    </View>
  );
}
