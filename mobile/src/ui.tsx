import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "./theme";

export function Screen({
  children,
  refreshing,
  onRefresh,
  pad = true,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  pad?: boolean;
}) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, pad && styles.pad]}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.burgundy} /> : undefined}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const body = <View style={styles.card}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      {body}
    </Pressable>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Body({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Button({ label, onPress, kind = "primary", disabled }: { label: string; onPress: () => void; kind?: "primary" | "ghost"; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[kind === "primary" ? styles.primary : styles.ghost, disabled && { opacity: 0.5 }]}
    >
      <Text style={kind === "primary" ? styles.primaryText : styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChange,
  keyboard,
  secret,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboard?: "email-address" | "numeric" | "phone-pad" | "default";
  secret?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        secureTextEntry={secret}
        keyboardType={keyboard ?? "default"}
        multiline={multiline}
        style={[styles.input, multiline && { minHeight: 96, textAlignVertical: "top" }]}
      />
    </View>
  );
}

export function Empty({ label }: { label: string }) {
  return <Text style={styles.muted}>{label}</Text>;
}

export function Banner({ text, tone = "note" }: { text: string; tone?: "note" | "error" }) {
  if (!text) return null;
  const html = /<!DOCTYPE|<html[\s>]|parastorage\.com/i.test(text);
  const shown = html ? "Could not load the Foundation app feed. Pull down to retry." : text;
  return (
    <View style={[styles.banner, tone === "error" && { backgroundColor: "#F8E8E8" }]}>
      <Text style={{ color: tone === "error" ? colors.burgundy : colors.ink, fontWeight: "600" }}>{shown}</Text>
    </View>
  );
}

export function Loading({ label = "Loading the Foundation app…" }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.burgundy} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function Cover({ uri, height = 180 }: { uri?: string; height?: number }) {
  if (!uri) return null;
  return <Image source={{ uri }} style={{ width: "100%", height, borderRadius: 12, marginBottom: 12, backgroundColor: colors.paper }} resizeMode="cover" />;
}

export function BrandMark({ uri, name }: { uri?: string; name: string }) {
  if (uri) return <Image source={{ uri }} style={styles.logo} />;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{(name || "V").slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 40 },
  pad: { padding: 16 },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink, marginBottom: 8 },
  muted: { color: colors.muted, lineHeight: 20, marginTop: 4 },
  body: { color: colors.ink, lineHeight: 22, marginTop: 8 },
  primary: { marginTop: 8, backgroundColor: colors.burgundy, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  primaryText: { color: colors.white, fontWeight: "700" },
  ghost: { marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  ghostText: { color: colors.ink, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.white, color: colors.ink },
  label: { color: colors.muted, marginBottom: 6, fontSize: 13, fontWeight: "600" },
  banner: { backgroundColor: colors.paper, padding: 10, borderRadius: 12, marginBottom: 12 },
  center: { padding: 40, alignItems: "center", gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper },
  badge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.burgundy, alignItems: "center", justifyContent: "center" },
  badgeText: { color: colors.white, fontWeight: "800" },
});
