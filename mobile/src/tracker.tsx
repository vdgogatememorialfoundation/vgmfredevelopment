import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";

export type TrackEvent = { title?: string; when?: string; location?: string; detail?: string; notice?: string };
export type TrackStage = { id?: string; label?: string; caption?: string; reached?: boolean; partial?: boolean; events?: TrackEvent[] };

const TL_GREEN = "#067D62";
const TL_GREEN_SOFT = "#ECFDF5";
const TL_LINE = "#E5E7EB";
const TL_TEXT = "#111827";
const TL_MUTED = "#6B7280";
const TL_FAILED = "#DC2626";
const DOT_SIZE = 16;
const DOT_TOP = 3;
const RAIL_LEFT = 12; // center of 26px rail column (13 - 1.5)

function cleanExpected(text?: string) {
  const s = (text ?? "").trim();
  if (!s || /yet to be dispatched|pending|n\/a|null|undefined/i.test(s)) return "";
  return s;
}

function PulseRing({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        backgroundColor: color,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.35] }) }],
      }}
    />
  );
}

function BoldCourierText({ text }: { text: string }) {
  const parts = text.split(/((?:Courier|Tracking id|Tracking ID|AWB(?: no\.)?):?\s*)([^·]+)/);
  return (
    <Text style={{ fontSize: 12.5, color: TL_MUTED, lineHeight: 18 }}>
      {parts.map((part, index) =>
        index % 3 === 2 ? (
          <Text key={index} style={{ fontWeight: "700", color: TL_TEXT }}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

/**
 * Animated downward-moving order tracking pipeline (matches vaidyagogate.org VerticalPipeline.tsx):
 * - Measures exact Y positions of every step via onLayout
 * - Animates the green progress bar smoothly downward from step 0 to the active step
 * - Lights up each dot right as the moving green line reaches it
 * - Then smoothly creeps forward toward the next upcoming step (unless terminal/delivered)
 */
export function Pipeline({
  stages,
  current,
  failed,
  expected,
  footer,
  shippedWith,
}: {
  stages: TrackStage[];
  current: number;
  failed?: boolean;
  expected?: string;
  footer?: string;
  shippedWith?: string;
}) {
  const safeExpected = cleanExpected(expected);
  const last = stages.length - 1;
  const clampedCurrent = Math.max(0, Math.min(last, current));
  const firstUpcoming = stages.findIndex((stage, index) => !stage.reached && index > clampedCurrent);

  const [rowLayouts, setRowLayouts] = useState<Record<number, { y: number; height: number }>>({});
  const [litIdx, setLitIdx] = useState(-1);
  const fillHeight = useRef(new Animated.Value(0)).current;

  const firstLayout = rowLayouts[0];
  const lastLayout = rowLayouts[last];
  const currentLayout = rowLayouts[clampedCurrent];
  const nextLayout = rowLayouts[clampedCurrent + 1];

  const startY = firstLayout ? firstLayout.y + DOT_TOP + DOT_SIZE / 2 : 0;
  const totalTrackHeight = firstLayout && lastLayout ? Math.max(0, lastLayout.y + DOT_TOP + DOT_SIZE / 2 - startY) : 0;

  useEffect(() => {
    if (!firstLayout || !currentLayout) return;
    const reachedCenterY = currentLayout.y + DOT_TOP + DOT_SIZE / 2;
    const isFinal = clampedCurrent >= last || /delivered|picked|failed|cancelled|refunded/i.test(stages[clampedCurrent]?.id ?? "");
    // Include nested scans inside the current step, then add a gentle lead into the gap toward the next step.
    const reachedHeight = Math.max(0, reachedCenterY - startY);
    const creepTarget =
      !isFinal && nextLayout
        ? Math.max(reachedHeight, nextLayout.y + DOT_TOP + DOT_SIZE / 2 - startY - Math.max(18, (nextLayout.y - currentLayout.y) * 0.55))
        : reachedHeight;

    fillHeight.setValue(0);
    setLitIdx(0);

    const listenerId = fillHeight.addListener(({ value }) => {
      const tipY = startY + value;
      let highest = 0;
      for (let i = 0; i <= clampedCurrent; i++) {
        const box = rowLayouts[i];
        if (box && tipY >= box.y + DOT_TOP + 2) highest = i;
      }
      setLitIdx((prev) => (highest > prev ? highest : prev));
    });

    const durationToStep = Math.min(3200, Math.max(900, (clampedCurrent + 1) * 750));
    const seq = Animated.sequence([
      Animated.timing(fillHeight, {
        toValue: reachedHeight,
        duration: durationToStep,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
      ...(creepTarget > reachedHeight + 2
        ? [
            Animated.timing(fillHeight, {
              toValue: creepTarget,
              duration: 2400,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
          ]
        : []),
    ]);

    seq.start(() => {
      setLitIdx(clampedCurrent);
    });

    return () => {
      seq.stop();
      fillHeight.removeListener(listenerId);
    };
  }, [clampedCurrent, firstLayout?.y, currentLayout?.y, nextLayout?.y, stages.length]);

  return (
    <View style={{ backgroundColor: "#FFFFFF", paddingTop: 6, paddingBottom: 4 }}>
      <View style={{ position: "relative" }}>
        {/* Continuous grey background rail */}
        {totalTrackHeight > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: RAIL_LEFT,
              top: startY,
              width: 3,
              height: totalTrackHeight,
              borderRadius: 2,
              backgroundColor: TL_LINE,
            }}
          />
        ) : null}

        {/* Animated green downward-moving fill line */}
        {totalTrackHeight > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: RAIL_LEFT,
              top: startY,
              width: 3,
              height: fillHeight,
              borderRadius: 2,
              backgroundColor: failed ? TL_FAILED : TL_GREEN,
            }}
          />
        ) : null}

        {stages.map((stage, index) => {
          const reached = Boolean(stage.reached) || index <= clampedCurrent;
          const active = index === clampedCurrent;
          const upcoming = !reached && !active;
          const isLit = index <= litIdx;
          const failedStep = Boolean(failed && (active || /fail|reject|cancel|rto/i.test(stage.id ?? "")));
          const dotColor = failedStep ? TL_FAILED : reached && isLit ? TL_GREEN : TL_LINE;
          const events = stage.events ?? [];
          const stamp = events[0]?.when ?? "";
          const showUpcomingExpected = index === firstUpcoming && Boolean(safeExpected) && !failed;
          const showActiveExpected = active && index === last - 1 && !showUpcomingExpected && Boolean(safeExpected) && !failed;

          return (
            <View
              key={`${stage.id ?? stage.label}-${index}`}
              onLayout={(e) => {
                const { y, height } = e.nativeEvent.layout;
                setRowLayouts((prev) => {
                  const cur = prev[index];
                  if (cur && Math.abs(cur.y - y) < 1 && Math.abs(cur.height - height) < 1) return prev;
                  return { ...prev, [index]: { y, height } };
                });
              }}
              style={{ flexDirection: "row" }}
            >
              <View style={{ width: 27, alignItems: "center" }}>
                <View
                  style={{
                    width: DOT_SIZE,
                    height: DOT_SIZE,
                    borderRadius: DOT_SIZE / 2,
                    marginTop: DOT_TOP,
                    backgroundColor: reached && isLit ? dotColor : "#FFFFFF",
                    borderWidth: 2,
                    borderColor: dotColor,
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                  }}
                >
                  {active && isLit && !failed && index < last ? <PulseRing color={TL_GREEN} /> : null}
                  {reached && isLit && !active ? <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "900" }}>✓</Text> : null}
                </View>
              </View>

              <View style={{ flex: 1, paddingLeft: 12, paddingBottom: index < last ? 22 : 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <Text style={{ fontSize: 15, fontWeight: upcoming ? "500" : "700", color: upcoming ? TL_MUTED : TL_TEXT }}>
                    {stage.label}
                  </Text>
                  {stamp && !upcoming ? <Text style={{ fontSize: 11.5, color: TL_MUTED, fontWeight: "600" }}>{stamp}</Text> : null}
                </View>

                {stage.caption && !upcoming ? (
                  <Text style={{ marginTop: 2, fontSize: 13, color: TL_TEXT, lineHeight: 19 }}>{stage.caption}</Text>
                ) : null}

                {showUpcomingExpected ? (
                  <Text style={{ marginTop: 3, fontSize: 12.5, fontWeight: "700", color: TL_GREEN }}>
                    Expected by {safeExpected}
                  </Text>
                ) : null}

                {showActiveExpected ? (
                  <View style={{ alignSelf: "flex-start", marginTop: 6, backgroundColor: TL_GREEN_SOFT, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: TL_GREEN }}>Expected by {safeExpected}</Text>
                  </View>
                ) : null}

                {stage.id === "shipped" && reached && shippedWith ? (
                  <View style={{ marginTop: 8, backgroundColor: "#F8F9FB", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <BoldCourierText text={shippedWith} />
                  </View>
                ) : null}

                {events.length > 0 && reached ? (
                  <View style={{ marginTop: 7, gap: 7 }}>
                    {events.map((event, eventIndex) => {
                      const bad = /fail|undeliver|rto/i.test(event.title ?? "");
                      return (
                        <View key={`${event.title}-${eventIndex}`}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: bad ? TL_FAILED : TL_TEXT, lineHeight: 18 }}>
                            {event.title}
                          </Text>
                          {event.when ? <Text style={{ fontSize: 11.5, color: TL_MUTED, marginTop: 1 }}>{event.when}</Text> : null}
                          {event.location ? <Text style={{ fontSize: 11.5, color: TL_MUTED }}>{event.location}</Text> : null}
                          {event.detail ? <BoldCourierText text={event.detail} /> : null}
                          {event.notice ? <Text style={{ marginTop: 3, fontSize: 13, fontWeight: "700", color: TL_TEXT }}>{event.notice}</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {footer ? (
        <View style={{ marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
          <BoldCourierText text={footer} />
        </View>
      ) : null}
    </View>
  );
}

/** Crisp light info tiles above the pipeline. */
export function InfoTiles({ tiles }: { tiles: { label: string; value: string }[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {tiles
        .filter((tile) => tile.value)
        .map((tile) => (
          <View
            key={tile.label}
            style={{
              flexGrow: 1,
              flexBasis: "45%",
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              backgroundColor: "#F8F9FB",
              paddingVertical: 9,
              paddingHorizontal: 11,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: TL_MUTED }}>
              {tile.label}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 13.5, fontWeight: "700", color: TL_TEXT }}>{tile.value}</Text>
          </View>
        ))}
    </View>
  );
}
