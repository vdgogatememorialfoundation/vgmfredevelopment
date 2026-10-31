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
        contentContainerStyle={{ paddingBottom: 36, paddingHorizontal: pad ? 20 : 0, paddingTop: pad ? 8 : 0 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} /> : undefined}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({
  children,
  onPress,
  featured,
  pad = 16,
}: {
  children: ReactNode;
  onPress?: () => void;
  featured?: boolean;
  pad?: number;
}) {
  const theme = useTheme();
  const body = (
    <View
      style={{
        backgroundColor: theme.colors.paper,
        borderColor: featured ? theme.colors.accent : theme.colors.border,
        borderWidth: 1,
        borderRadius: 18,
        padding: pad,
        marginBottom: 12,
      }}
    >
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
      {body}
    </Pressable>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.primary,
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1.6,
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ fontSize: 28, fontWeight: "700", color: theme.colors.primary, marginBottom: 6, fontFamily: theme.fontFamily, letterSpacing: -0.4, lineHeight: 34 }}>
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ fontSize: 17, fontWeight: "700", color: theme.colors.text, fontFamily: theme.fontFamily, letterSpacing: -0.2, lineHeight: 22 }}>
      {children}
    </Text>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={{ color: theme.colors.muted, lineHeight: 21, marginTop: 4, fontSize: 13 }}>{children}</Text>;
}

export function Body({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={{ color: theme.colors.text, lineHeight: 23, marginTop: 8, fontSize: 15 }}>{children}</Text>;
}

export function PageHeader({
  kicker,
  title,
  subtitle,
  trailing,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, marginTop: 8 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        <Title>{title}</Title>
        {subtitle ? <Muted>{subtitle}</Muted> : null}
      </View>
      {trailing}
    </View>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 18 }} />;
}

export function Button({
  label,
  onPress,
  kind = "primary",
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "ghost" | "soft" | "ink";
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.colors.primary, border: theme.colors.primary, text: theme.colors.onPrimary },
    ghost: { bg: theme.colors.paper, border: theme.colors.border, text: theme.colors.text },
    soft: { bg: theme.colors.surface, border: theme.colors.accent, text: theme.colors.primary },
    ink: { bg: theme.colors.secondary, border: theme.colors.secondary, text: theme.colors.onPrimary },
  }[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          marginTop: 10,
          backgroundColor: palette.bg,
          borderRadius: 12,
          paddingVertical: 13,
          paddingHorizontal: 16,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          borderWidth: 1,
          borderColor: palette.border,
          minHeight: 48,
          opacity: disabled ? 0.45 : pressed ? 0.9 : 1,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={palette.text} /> : null}
      <Text style={{ color: palette.text, fontWeight: "700", fontSize: 13, letterSpacing: 0.2 }}>{label}</Text>
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboard?: "email-address" | "numeric" | "phone-pad" | "default";
  secret?: boolean;
  multiline?: boolean;
  autoCapitalize?: "none" | "words" | "sentences";
  placeholder?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: theme.colors.muted, marginBottom: 6, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        secureTextEntry={secret}
        keyboardType={keyboard ?? "default"}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        accessibilityLabel={label}
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 12,
          padding: 13,
          minHeight: 48,
          backgroundColor: theme.colors.paper,
          color: theme.colors.text,
          fontSize: 15,
          ...(multiline ? { minHeight: 110, textAlignVertical: "top" as const } : {}),
        }}
      />
    </View>
  );
}

export function Empty({
  label,
  actionLabel,
  onAction,
  icon = "leaf-outline",
}: {
  label: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  return (
    <View style={{ paddingVertical: 28, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.paper, marginBottom: 12, alignItems: "center" }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Ionicons name={icon} size={22} color={theme.colors.accent} />
      </View>
      <Text style={{ color: theme.colors.muted, lineHeight: 21, textAlign: "center", fontSize: 14 }}>{label}</Text>
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
  const fg = tone === "error" ? theme.colors.primary : tone === "success" ? "#1F4A32" : theme.colors.text;
  return (
    <View style={{ backgroundColor: bg, padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border }}>
      <Text style={{ color: fg, fontWeight: "600", lineHeight: 20 }}>{shown}</Text>
    </View>
  );
}

export function Loading({ label = "Loading the Foundation…" }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, padding: 40, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background, gap: 12 }}>
      <ActivityIndicator color={theme.colors.primary} />
      <Text style={{ color: theme.colors.muted }}>{label}</Text>
    </View>
  );
}

export function Cover({ uri, height = 180, ratio, fit = "cover" }: { uri?: string; height?: number; ratio?: "square" | "wide"; fit?: "cover" | "contain" }) {
  const theme = useTheme();
  if (!uri) return null;
  return (
    <Image
      source={{ uri }}
      accessibilityLabel="Published image"
      style={{
        width: "100%",
        height: ratio === "square" ? undefined : height,
        aspectRatio: ratio === "square" ? 1 : ratio === "wide" ? 16 / 10 : undefined,
        borderRadius: 14,
        marginBottom: 12,
        backgroundColor: theme.colors.background,
      }}
      resizeMode={fit}
    />
  );
}

export function BrandMark({ uri, name, size = 36 }: { uri?: string; name: string; size?: number }) {
  const theme = useTheme();
  if (uri) {
    return <Image source={{ uri }} accessibilityLabel={name} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.colors.paper }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: theme.colors.onPrimary, fontWeight: "800", fontSize: size * 0.36 }}>{(name || "V").slice(0, 1).toUpperCase()}</Text>
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
        borderRadius: 999,
        paddingHorizontal: 14,
        minHeight: 48,
        marginBottom: 18,
      }}
    >
      <Ionicons name="search" size={16} color={theme.colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        returnKeyType="search"
        accessibilityLabel="Search"
        style={{ flex: 1, color: theme.colors.text, paddingVertical: 12, fontSize: 14 }}
      />
      {value ? (
        <Pressable onPress={() => onChange("")} accessibilityLabel="Clear search" hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={theme.colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function SectionHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle?: string; actionLabel?: string; onAction?: () => void }) {
  const theme = useTheme();
  if (!title && !subtitle) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12, marginTop: 8 }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        {title ? <Text style={{ fontSize: 20, fontWeight: "700", color: theme.colors.primary, fontFamily: theme.fontFamily }}>{title}</Text> : null}
        {subtitle ? <Text style={{ color: theme.colors.muted, marginTop: 3, fontSize: 12 }}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: theme.colors.primary, fontWeight: "700", fontSize: 13 }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chip({ label, onPress, selected }: { label: string; onPress?: () => void; selected?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={{
        backgroundColor: selected ? theme.colors.primary : theme.colors.paper,
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        minHeight: 36,
      }}
    >
      <Text style={{ color: selected ? theme.colors.onPrimary : theme.colors.text, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

export function IconTile({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [{ width: "23%", minWidth: 70, alignItems: "center", paddingVertical: 10, opacity: pressed ? 0.88 : 1 }]}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.paper, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
        <Ionicons name={icon} size={18} color={theme.colors.primary} />
      </View>
      <Text style={{ color: theme.colors.text, fontWeight: "600", fontSize: 11, textAlign: "center" }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatusChip({ label }: { label: string }) {
  const theme = useTheme();
  if (!label) return null;
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: theme.colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

export function DateBadge({ label }: { label: string }) {
  const theme = useTheme();
  if (!label) return null;
  return (
    <View style={{ backgroundColor: theme.colors.secondary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, alignSelf: "flex-start" }}>
      <Text style={{ color: theme.colors.onPrimary, fontSize: 10, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

export function Price({ value, original }: { value: string; original?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 }}>
      <Text style={{ color: theme.colors.primary, fontWeight: "800", fontSize: 18, fontFamily: theme.fontFamily }}>{value}</Text>
      {original ? <Text style={{ color: theme.colors.muted, textDecorationLine: "line-through", fontSize: 12 }}>{original}</Text> : null}
    </View>
  );
}

export function ListRow({ icon, title, subtitle, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: theme.colors.paper,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: 16,
          padding: 14,
          marginBottom: 8,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={18} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{title}</Text>
        {subtitle ? <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
    </Pressable>
  );
}

export function QtyStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
      <Pressable onPress={() => onChange(Math.max(1, value - 1))} accessibilityLabel="Decrease quantity" style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.paper, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 18, color: theme.colors.text }}>−</Text>
      </Pressable>
      <Text style={{ minWidth: 24, textAlign: "center", fontWeight: "700", color: theme.colors.text, fontSize: 16 }}>{value}</Text>
      <Pressable onPress={() => onChange(value + 1)} accessibilityLabel="Increase quantity" style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.paper, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 18, color: theme.colors.text }}>+</Text>
      </Pressable>
    </View>
  );
}

export function IconButton({ icon, label, onPress, badge }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; badge?: number }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={badge ? `${label} ${badge}` : label}
      accessibilityRole="button"
      style={({ pressed }) => [{ width: 38, height: 38, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={theme.colors.text} />
      {badge ? (
        <View style={{ position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
          <Text style={{ color: theme.colors.onPrimary, fontSize: 9, fontWeight: "800" }}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Portrait({ uri, label, size = 80 }: { uri?: string; label: string; size?: number }) {
  const theme = useTheme();
  return (
    <Image
      source={uri ? { uri } : undefined}
      accessibilityLabel={label}
      style={{ width: size, height: size, borderRadius: 10, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border }}
      resizeMode="cover"
    />
  );
}

export function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
      <Text style={{ color: theme.colors.primary, fontWeight: "700", fontSize: 13 }}>{label}</Text>
      <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
    </Pressable>
  );
}

export function SiteFooter() {
  const theme = useTheme();
  return (
    <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
      <Text style={{ color: theme.colors.primary, fontFamily: theme.fontFamily, fontSize: 16, textAlign: "center" }}>वैद्य गोगटे स्मृती प्रतिष्ठान</Text>
      <Text style={{ color: theme.colors.muted, fontSize: 11, textAlign: "center", marginTop: 6, lineHeight: 16 }}>
        Vaidya Gogate Memorial Foundation · Pune, India{"\n"}Registered charitable trust · Affiliated with Central Council of Indian Medicine archives
      </Text>
    </View>
  );
}
