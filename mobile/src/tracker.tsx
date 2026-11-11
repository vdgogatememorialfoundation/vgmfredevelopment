import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { useTheme } from "./theme";

export type TrackEvent = { title?: string; when?: string; location?: string; detail?: string };
export type TrackStage = { id?: string; label?: string; caption?: string; reached?: boolean; partial?: boolean; events?: TrackEvent[] };

const DONE = "#0F7B5F";
const FAILED = "#B42318";
const IDLE = "#D9CDB8";

/** Live "beep": a ring that keeps pulsing out of the current step's dot. */
function Beep({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: color,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
      }}
    />
  );
}

/** Native copy of the website's vertical tracker: dots, a filled line up to the current step, and each step's scans. */
export function Pipeline({ stages, current, failed, expected, footer }: { stages: TrackStage[]; current: number; failed?: boolean; expected?: string; footer?: string }) {
  const theme = useTheme();
  const last = stages.length - 1;
  return (
    <View style={{ marginTop: 6 }}>
      {stages.map((stage, index) => {
        const reached = Boolean(stage.reached) || index <= current;
        const active = index === current;
        const tone = failed && active ? FAILED : reached ? DONE : IDLE;
        const lineFilled = index < current && Boolean(stages[index + 1]?.reached ?? true);
        const events = stage.events ?? [];
        const stamp = events[0]?.when ?? "";
        return (
          <View key={`${stage.id ?? stage.label}-${index}`} style={{ flexDirection: "row" }}>
            <View style={{ width: 30, alignItems: "center" }}>
              <View
                style={{
                  width: active ? 22 : 18,
                  height: active ? 22 : 18,
                  borderRadius: 11,
                  marginTop: 2,
                  backgroundColor: reached ? tone : theme.colors.paper,
                  borderWidth: 3,
                  borderColor: active ? (failed ? "#F4C7C3" : "#BFE7D9") : tone,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {active && !failed && index < last ? <Beep color={DONE} /> : null}
                {reached && !active ? <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>✓</Text> : null}
              </View>
              {index < last ? <View style={{ flex: 1, width: 3, minHeight: 26, marginVertical: 2, borderRadius: 2, backgroundColor: lineFilled ? DONE : IDLE }} /> : null}
            </View>
            <View style={{ flex: 1, paddingLeft: 10, paddingBottom: index < last ? 18 : 4 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <Text style={{ fontSize: 15.5, fontWeight: reached ? "800" : "600", color: reached ? theme.colors.text : theme.colors.muted }}>{stage.label}</Text>
                {stamp ? <Text style={{ fontSize: 12, color: theme.colors.muted }}>{stamp}</Text> : null}
              </View>
              {stage.caption ? <Text style={{ marginTop: 2, fontSize: 13, color: theme.colors.muted }}>{stage.caption}</Text> : null}
              {active && expected && !failed ? (
                <Text style={{ marginTop: 4, fontSize: 13, fontWeight: "700", color: DONE }}>Expected delivery by {expected}</Text>
              ) : null}
              {events.length > 0 && reached ? (
                <View style={{ marginTop: 8, gap: 8, borderLeftWidth: 2, borderLeftColor: theme.colors.border, paddingLeft: 10 }}>
                  {events.map((event, eventIndex) => (
                    <View key={`${event.title}-${eventIndex}`}>
                      <Text style={{ fontSize: 13.5, fontWeight: "600", color: theme.colors.text }}>{event.title}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.muted }}>{[event.when, event.location].filter(Boolean).join(" · ")}</Text>
                      {event.detail ? <Text style={{ fontSize: 12, color: theme.colors.muted }}>{event.detail}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
      {footer ? <Text style={{ marginTop: 8, fontSize: 12.5, color: theme.colors.muted }}>{footer}</Text> : null}
    </View>
  );
}

/** The small info tiles shown above the website tracker (Order, Date, Status, Courier). */
export function InfoTiles({ tiles }: { tiles: { label: string; value: string }[] }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {tiles
        .filter((tile) => tile.value)
        .map((tile) => (
          <View key={tile.label} style={{ flexGrow: 1, flexBasis: "45%", borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background, paddingVertical: 10, paddingHorizontal: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: theme.colors.muted }}>{tile.label}</Text>
            <Text style={{ marginTop: 3, fontSize: 14.5, fontWeight: "700", color: theme.colors.text }}>{tile.value}</Text>
          </View>
        ))}
    </View>
  );
}
