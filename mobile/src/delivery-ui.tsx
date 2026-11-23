import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Animated, Image, Linking, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { rider, type Question } from "./delivery-api";
import { P } from "./portal-ui";
import { sounds } from "./delivery-sounds";

/** Amazon Flex–style palette: white surfaces, near-black text, one teal action colour. */
export const FLEX = { accent: "#0A7EA4", accentSoft: "#E6F4F9", ink: "#0F1111", bg: "#F2F4F5", line: "#D5D9D9" };

export const money = (value: number) => `₹${Math.round(Number(value || 0) * 100) / 100}`;

export const KIND_LABEL: Record<string, { label: string; icon: string; color: string; soft: string }> = {
  delivery: { label: "Deliver", icon: "cube", color: P.green, soft: P.greenSoft },
  pickup: { label: "Pickup", icon: "arrow-up-circle", color: P.blue, soft: P.blueSoft },
  return: { label: "Return", icon: "return-down-back", color: P.amber, soft: P.amberSoft },
  obd: { label: "OBD", icon: "eye", color: P.brand, soft: P.brandSoft },
  replacement: { label: "Replacement", icon: "swap-horizontal", color: "#6D28D9", soft: "#F5F3FF" },
};

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[d.card, style]}>{children}</View>;
}

export function KindTag({ kind }: { kind: string }) {
  const k = KIND_LABEL[kind] ?? KIND_LABEL.delivery;
  return (
    <View style={[d.tag, { backgroundColor: k.soft }]}>
      <Ionicons name={k.icon as never} size={12} color={k.color} />
      <Text style={[d.tagText, { color: k.color }]}>{k.label}</Text>
    </View>
  );
}

export function CountChip({ icon, label, value, color = P.ink }: { icon: string; label: string; value: number; color?: string }) {
  return (
    <View style={d.chip}>
      <Ionicons name={icon as never} size={16} color={color} />
      <Text style={d.chipValue}>{value}</Text>
      <Text style={d.chipLabel}>{label}</Text>
    </View>
  );
}

export function Btn({ label, icon, onPress, tone = "brand", disabled, busy, flex }: { label: string; icon?: string; onPress: () => void; tone?: "brand" | "green" | "red" | "outline" | "blue"; disabled?: boolean; busy?: boolean; flex?: boolean }) {
  const bg = { brand: FLEX.accent, green: P.green, red: P.red, blue: P.blue, outline: P.white }[tone];
  const fg = tone === "outline" ? FLEX.accent : P.white;
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} style={[d.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 }, tone === "outline" && d.btnOutline, flex && { flex: 1 }]}>
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon as never} size={18} color={fg} /> : null}
      <Text style={[d.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={d.label}>{label}</Text>
      <TextInput placeholderTextColor={P.muted} style={d.input} {...props} />
    </View>
  );
}

export function callNumber(phone: string) {
  if (phone) void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`);
}

export function openMaps(address: string) {
  void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`);
}

export function errorAlert(e: unknown) {
  sounds.scanError();
  Alert.alert("Couldn't complete", e instanceof Error ? e.message : String(e));
}

export function Questionnaire({ questions, answers, onChange }: { questions: Question[]; answers: Record<string, string>; onChange: (next: Record<string, string>) => void }) {
  return (
    <View style={{ gap: 12 }}>
      {questions.map((q, index) => (
        <View key={q.id} style={{ gap: 8 }}>
          <Text style={d.q}>{index + 1}. {q.text}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {q.options.map((option) => {
              const on = answers[q.id] === option;
              return (
                <Pressable key={option} onPress={() => onChange({ ...answers, [q.id]: option })} style={[d.opt, on && d.optOn]}>
                  <Text style={[d.optText, on && { color: P.white }]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

export function PhotoStrip({ photos, onAdd, kind, min = 1 }: { photos: string[]; onAdd: (url: string) => void; kind: string; min?: number }) {
  const [busy, setBusy] = useState(false);
  const take = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) throw new Error("Allow camera access to take shipment photos.");
      const shot = await ImagePicker.launchCameraAsync({ quality: 0.45, base64: true, allowsEditing: false });
      if (shot.canceled || !shot.assets?.[0]?.base64) return;
      setBusy(true);
      const res = await rider.uploadPhoto(`data:image/jpeg;base64,${shot.assets[0].base64}`, kind);
      onAdd(res.url);
    } catch (e) {
      errorAlert(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={d.label}>Photos {photos.length < min ? `(at least ${min})` : `(${photos.length})`}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {photos.map((url) => (
          <Image key={url} source={{ uri: url }} style={d.thumb} />
        ))}
        <Pressable onPress={take} style={[d.thumb, d.addThumb]}>
          {busy ? <ActivityIndicator color={P.brand} /> : <Ionicons name="camera" size={24} color={P.brand} />}
        </Pressable>
      </View>
    </View>
  );
}

export function SwipeToAccept({ label, onAccept }: { label: string; onAccept: () => void }) {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const knob = 56;
  const max = Math.max(0, width - knob - 8);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, g) => x.setValue(Math.max(0, Math.min(g.dx, maxRef.current))),
      onPanResponderRelease: (_e, g) => {
        if (g.dx >= maxRef.current * 0.85) {
          Animated.timing(x, { toValue: maxRef.current, duration: 120, useNativeDriver: false }).start(() => {
            onAcceptRef.current();
            x.setValue(0);
          });
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    })
  ).current;
  const maxRef = useRef(max);
  maxRef.current = max;
  const onAcceptRef = useRef(onAccept);
  onAcceptRef.current = onAccept;
  return (
    <View style={d.swipe} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Text style={d.swipeText}>{label}</Text>
      <Animated.View {...pan.panHandlers} style={[d.knob, { transform: [{ translateX: x }] }]}>
        <Ionicons name="chevron-forward" size={26} color={P.white} />
      </Animated.View>
    </View>
  );
}

export const d = StyleSheet.create({
  screen: { flex: 1, backgroundColor: FLEX.bg },
  pad: { padding: 14, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: P.white, borderRadius: 10, borderWidth: 1, borderColor: FLEX.line, padding: 16, gap: 10, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  h1: { fontSize: 22, fontWeight: "800", color: FLEX.ink },
  h2: { fontSize: 17, fontWeight: "700", color: FLEX.ink },
  body: { fontSize: 15, color: FLEX.ink, lineHeight: 21 },
  muted: { fontSize: 13, color: P.muted, lineHeight: 18 },
  label: { fontSize: 12.5, fontWeight: "700", color: P.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: P.ink, backgroundColor: P.white },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" },
  tagText: { fontSize: 11.5, fontWeight: "800" },
  chip: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 8, borderRadius: 10, backgroundColor: P.bg },
  chipValue: { fontSize: 16, fontWeight: "800", color: P.ink },
  chipLabel: { fontSize: 10.5, fontWeight: "700", color: P.muted },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 52, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8 },
  btnOutline: { borderWidth: 1.5, borderColor: FLEX.accent },
  btnText: { fontSize: 16, fontWeight: "700" },
  q: { fontSize: 14.5, fontWeight: "700", color: P.ink },
  opt: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: P.border, backgroundColor: P.white },
  optOn: { backgroundColor: FLEX.accent, borderColor: FLEX.accent },
  optText: { fontSize: 13.5, fontWeight: "700", color: P.ink },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: P.bg },
  addThumb: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: P.brand },
  swipe: { height: 64, borderRadius: 32, backgroundColor: P.greenSoft, borderWidth: 1, borderColor: P.green, justifyContent: "center", overflow: "hidden" },
  swipeText: { textAlign: "center", fontSize: 15.5, fontWeight: "800", color: P.green },
  knob: { position: "absolute", left: 4, width: 56, height: 56, borderRadius: 28, backgroundColor: P.green, alignItems: "center", justifyContent: "center" },
  filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: P.border, backgroundColor: P.white },
  filterOn: { backgroundColor: FLEX.ink, borderColor: FLEX.ink },
  filterText: { fontSize: 13, fontWeight: "700", color: P.ink },
  big: { fontSize: 30, fontWeight: "900", color: FLEX.ink, letterSpacing: 1 },
  stopRow: { flexDirection: "row", gap: 12 },
  stopRail: { width: 34, alignItems: "center" },
  stopNum: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: FLEX.ink },
  stopNumText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  stopLine: { flex: 1, width: 2, backgroundColor: FLEX.line, marginTop: 4 },
  bottomBar: { padding: 12, paddingBottom: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: FLEX.line, gap: 6 },
});
