import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./theme";

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
  const theme = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40, padding: pad ? theme.space.md : 0 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} /> : undefined}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const theme = useTheme();
  const body = (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: theme.radius.lg,
        padding: theme.space.md,
        marginBottom: theme.space.sm,
      }}
    >
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [pressed && { opacity: 0.88 }]}>
      {body}
    </Pressable>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ fontSize: theme.type.title, fontWeight: "800", color: theme.colors.text, marginBottom: theme.space.sm, fontFamily: theme.fontFamily }}>
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ fontSize: theme.type.heading, fontWeight: "700", color: theme.colors.text, fontFamily: theme.fontFamily }}>
      {children}
    </Text>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ color: theme.colors.muted, lineHeight: 20, marginTop: 4, fontSize: theme.type.caption + 1, fontFamily: theme.fontFamily }}>
      {children}
    </Text>
  );
}

export function Body({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ color: theme.colors.text, lineHeight: 22, marginTop: 8, fontSize: theme.type.body, fontFamily: theme.fontFamily }}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  kind = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "ghost";
  disabled?: boolean;
}) {
  const theme = useTheme();
  const primary = kind === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          marginTop: theme.space.sm,
          backgroundColor: primary ? theme.colors.primary : theme.colors.paper,
          borderRadius: theme.radius.md,
          paddingVertical: 14,
          alignItems: "center",
          borderWidth: primary ? 0 : 1,
          borderColor: theme.colors.border,
          minHeight: 48,
          justifyContent: "center",
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
        },
      ]}
    >
      <Text style={{ color: primary ? theme.colors.onPrimary : theme.colors.text, fontWeight: "700", fontFamily: theme.fontFamily }}>{label}</Text>
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
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboard?: "email-address" | "numeric" | "phone-pad" | "default";
  secret?: boolean;
  multiline?: boolean;
  autoCapitalize?: "none" | "words" | "sentences";
}) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.space.sm }}>
      <Text style={{ color: theme.colors.muted, marginBottom: 6, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        secureTextEntry={secret}
        keyboardType={keyboard ?? "default"}
        multiline={multiline}
        placeholderTextColor={theme.colors.muted}
        accessibilityLabel={label}
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          padding: 12,
          minHeight: 48,
          backgroundColor: theme.colors.paper,
          color: theme.colors.text,
          fontFamily: theme.fontFamily,
          ...(multiline ? { minHeight: 96, textAlignVertical: "top" as const } : {}),
        }}
      />
    </View>
  );
}

export function Empty({ label, actionLabel, onAction }: { label: string; actionLabel?: string; onAction?: () => void }) {
  const theme = useTheme();
  return (
    <View
      style={{
        padding: theme.space.lg,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        marginBottom: theme.space.sm,
      }}
    >
      <Text style={{ color: theme.colors.muted, lineHeight: 22, fontFamily: theme.fontFamily }}>{label}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} kind="ghost" onPress={onAction} /> : null}
    </View>
  );
}

export function Banner({ text, tone = "note" }: { text: string; tone?: "note" | "error" | "success" }) {
  const theme = useTheme();
  if (!text) return null;
  const html = /<!DOCTYPE|<html[\s>]|parastorage\.com/i.test(text);
  const shown = html ? "Could not load the Foundation app feed. Pull down to retry." : text;
  const bg = tone === "error" ? "#F8E8E8" : tone === "success" ? "#EAF6EE" : theme.colors.paper;
  return (
    <View style={{ backgroundColor: bg, padding: 12, borderRadius: theme.radius.md, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border }}>
      <Text style={{ color: tone === "error" ? theme.colors.primary : theme.colors.text, fontWeight: "600", fontFamily: theme.fontFamily }}>{shown}</Text>
    </View>
  );
}

export function Loading({ label = "Loading the Foundation app…" }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, padding: 40, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background, gap: 12 }}>
      <ActivityIndicator color={theme.colors.primary} />
      <Text style={{ color: theme.colors.muted, fontFamily: theme.fontFamily }}>{label}</Text>
    </View>
  );
}

export function Skeleton({ height = 16, width = "100%" }: { height?: number; width?: number | string }) {
  const theme = useTheme();
  return <View style={{ height, width: width as number, borderRadius: theme.radius.sm, backgroundColor: theme.colors.border, marginBottom: 8 }} />;
}

export function Cover({ uri, height = 180, ratio }: { uri?: string; height?: number; ratio?: "square" | "wide" }) {
  const theme = useTheme();
  if (!uri) return null;
  return (
    <Image
      source={{ uri }}
      accessibilityLabel="Published image"
      style={{
        width: "100%",
        height: ratio === "square" ? undefined : height,
        aspectRatio: ratio === "square" ? 1 : undefined,
        borderRadius: theme.radius.md,
        marginBottom: 12,
        backgroundColor: theme.colors.paper,
      }}
      resizeMode="contain"
    />
  );
}

export function BrandMark({ uri, name }: { uri?: string; name: string }) {
  const theme = useTheme();
  if (uri) return <Image source={{ uri }} accessibilityLabel={name} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.paper }} />;
  return (
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: theme.colors.onPrimary, fontWeight: "800" }}>{(name || "V").slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export function SearchBar({ value, onChange, onSubmit, placeholder }: { value: string; onChange: (value: string) => void; onSubmit?: () => void; placeholder: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: theme.colors.paper,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: theme.radius.pill,
        paddingHorizontal: 14,
        minHeight: 48,
        marginBottom: theme.space.md,
      }}
    >
      <Ionicons name="search" size={18} color={theme.colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        returnKeyType="search"
        accessibilityLabel="Search"
        style={{ flex: 1, color: theme.colors.text, paddingVertical: 10, fontFamily: theme.fontFamily }}
      />
    </View>
  );
}

export function SectionHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle?: string; actionLabel?: string; onAction?: () => void }) {
  const theme = useTheme();
  if (!title && !subtitle) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10, marginTop: 8 }}>
      <View style={{ flex: 1 }}>
        {title ? <Text style={{ fontSize: theme.type.heading, fontWeight: "800", color: theme.colors.text, fontFamily: theme.fontFamily }}>{title}</Text> : null}
        {subtitle ? <Text style={{ color: theme.colors.muted, marginTop: 2, fontSize: theme.type.caption }}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chip({ label, onPress }: { label: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={{
        backgroundColor: theme.colors.paper,
        borderRadius: theme.radius.md,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: theme.colors.border,
        minWidth: 96,
      }}
    >
      <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function StatusChip({ label }: { label: string }) {
  const theme = useTheme();
  if (!label) return null;
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: theme.colors.paper, borderColor: theme.colors.accent, borderWidth: 1, borderRadius: theme.radius.pill, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ color: theme.colors.primary, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function QtyStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable onPress={() => onChange(Math.max(1, value - 1))} accessibilityLabel="Decrease quantity" style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 18, color: theme.colors.text }}>−</Text>
      </Pressable>
      <Text style={{ minWidth: 20, textAlign: "center", fontWeight: "700", color: theme.colors.text }}>{value}</Text>
      <Pressable onPress={() => onChange(value + 1)} accessibilityLabel="Increase quantity" style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 18, color: theme.colors.text }}>+</Text>
      </Pressable>
    </View>
  );
}
