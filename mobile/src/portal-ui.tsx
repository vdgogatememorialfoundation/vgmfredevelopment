import { Ionicons } from "@expo/vector-icons";
import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import {
  formatINR,
  formatShortDate,
  portalLogin,
  portalOtpSend,
  portalOtpVerify,
  sendBalanceReminder,
  updatePortalOrder,
  type PortalOrder,
  type PortalSession,
} from "./portal-api";
import type { Flavor } from "./flavor";
import { Pipeline, type TrackStage } from "./tracker";

const LOGO = require("../assets/logo.png");

export const P = {
  bg: "#F8F9FB",
  white: "#FFFFFF",
  border: "#E5E7EB",
  ink: "#111827",
  muted: "#6B7280",
  brand: "#8F2D2D",
  brandSoft: "#FDF2F4",
  green: "#067D62",
  greenSoft: "#ECFDF5",
  amber: "#B45309",
  amberSoft: "#FEF3C7",
  blue: "#1D4ED8",
  blueSoft: "#EFF6FF",
  red: "#B91C1C",
  redSoft: "#FEF2F2",
};

export function PortalTopBar({
  title,
  subtitle,
  accent = P.brand,
  onRefresh,
  refreshing,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  rightAction?: ReactNode;
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        <View style={[styles.logoRing, { borderColor: `${accent}30` }]}>
          <Image source={LOGO} style={styles.logoImg} resizeMode="contain" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
          {subtitle ? <Text style={styles.topSub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {rightAction}
        {onRefresh ? (
          <Pressable onPress={onRefresh} style={styles.iconBtn} accessibilityLabel="Refresh">
            {refreshing ? (
              <ActivityIndicator size="small" color={accent} />
            ) : (
              <Ionicons name="refresh" size={19} color={P.ink} />
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export type PortalTabDef = {
  id: string;
  label: string;
  icon: string;
  badge?: number;
};

export function PortalTabBar({
  tabs,
  active,
  onSelect,
  accent = P.brand,
}: {
  tabs: PortalTabDef[];
  active: string;
  onSelect: (id: string) => void;
  accent?: string;
}) {
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const focused = tab.id === active;
        return (
          <Pressable key={tab.id} onPress={() => onSelect(tab.id)} style={styles.tabItem}>
            <View style={[styles.tabPill, focused && { backgroundColor: `${accent}14` }]}>
              <Ionicons
                name={(focused ? tab.icon : `${tab.icon}-outline`) as never}
                size={20}
                color={focused ? accent : P.muted}
              />
              {tab.badge && tab.badge > 0 ? (
                <View style={[styles.tabBadge, { backgroundColor: accent }]}>
                  <Text style={styles.tabBadgeText}>{tab.badge > 99 ? "99+" : tab.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabLabel, focused && { color: accent }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "green" | "amber" | "red" | "blue" | "brand" }) {
  const palette = {
    neutral: { bg: "#F3F4F6", fg: "#374151" },
    green: { bg: P.greenSoft, fg: P.green },
    amber: { bg: P.amberSoft, fg: P.amber },
    red: { bg: P.redSoft, fg: P.red },
    blue: { bg: P.blueSoft, fg: P.blue },
    brand: { bg: P.brandSoft, fg: P.brand },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.pillText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export function statusTone(status: string): "neutral" | "green" | "amber" | "red" | "blue" | "brand" {
  const s = status.toLowerCase();
  if (s === "delivered" || s === "paid" || s === "resolved") return "green";
  if (s === "packed" || s === "ready to ship" || s === "to ship" || s === "partially paid") return "amber";
  if (s === "cancelled" || s === "failed" || s === "pending") return "red";
  if (s === "shipped" || s === "out for delivery" || s === "in progress") return "blue";
  return "brand";
}

export function KpiCard({
  icon,
  label,
  value,
  hint,
  accent = P.brand,
  bg = P.brandSoft,
  onPress,
}: {
  icon: string;
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  bg?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.kpiCard}>
      <View style={[styles.kpiIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon as never} size={18} color={accent} />
      </View>
      <Text style={styles.kpiValue} numberOfLines={1}>{String(value)}</Text>
      <Text style={styles.kpiLabel} numberOfLines={1}>{label}</Text>
      {hint ? <Text style={styles.kpiHint} numberOfLines={1}>{hint}</Text> : null}
    </Pressable>
  );
}

export function SectionHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.sectionBtn}>
          <Text style={styles.sectionBtnText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={P.brand} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyBox({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.emptyBox}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as never} size={26} color={P.muted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  disabled,
  loading,
  variant = "primary",
  color = P.brand,
  compact = false,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "soft" | "green" | "amber";
  color?: string;
  compact?: boolean;
}) {
  const isSolid = variant === "primary" || variant === "green" || variant === "amber";
  const bg =
    variant === "primary"
      ? color
      : variant === "green"
      ? P.green
      : variant === "amber"
      ? P.amber
      : variant === "soft"
      ? `${color}14`
      : P.white;
  const fg = isSolid ? P.white : variant === "soft" ? color : P.ink;
  const borderColor = variant === "outline" ? P.border : "transparent";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        compact && styles.btnCompact,
        { backgroundColor: bg, borderColor, opacity: disabled || loading ? 0.55 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Ionicons name={icon as never} size={compact ? 15 : 17} color={fg} />
      ) : null}
      <Text style={[styles.btnText, compact && styles.btnTextCompact, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PortalSignIn({ flavor, onSignedIn }: { flavor: Flavor; onSignedIn: (session: PortalSession) => void }) {
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const signInPassword = async () => {
    if (!email.trim() || !password) {
      setError("Enter your portal email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const session = await portalLogin(email.trim(), password);
      onSignedIn(session);
    } catch (e) {
      setError((e as Error).message || "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async () => {
    if (!email.trim()) {
      setError("Enter your Foundation staff/admin email.");
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const res = await portalOtpSend(email.trim(), flavor.displayName);
      setOtpSent(true);
      setInfo(res.message || "A 6-digit code was sent to your email.");
    } catch (e) {
      setError((e as Error).message || "Could not send code.");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!code.trim()) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const session = await portalOtpVerify(email.trim(), code.trim());
      onSignedIn(session);
    } catch (e) {
      setError((e as Error).message || "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.white }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.authWrap} keyboardShouldPersistTaps="handled">
        <View style={styles.authLogoBox}>
          <Image source={LOGO} style={{ width: 52, height: 52 }} resizeMode="contain" />
        </View>
        <View style={[styles.authPill, { backgroundColor: `${flavor.accent}14` }]}>
          <Ionicons name="shield-checkmark" size={14} color={flavor.accent} />
          <Text style={[styles.authPillText, { color: flavor.accent }]}>VGMF Production Portal</Text>
        </View>
        <Text style={styles.authTitle}>{flavor.displayName}</Text>
        <Text style={styles.authSub}>{flavor.subtitle}</Text>

        <View style={styles.modeSwitch}>
          <Pressable
            onPress={() => { setMode("password"); setError(""); }}
            style={[styles.modeBtn, mode === "password" && styles.modeBtnActive]}
          >
            <Ionicons name="key-outline" size={15} color={mode === "password" ? flavor.accent : P.muted} />
            <Text style={[styles.modeText, mode === "password" && { color: flavor.accent }]}>Password</Text>
          </Pressable>
          <Pressable
            onPress={() => { setMode("otp"); setError(""); }}
            style={[styles.modeBtn, mode === "otp" && styles.modeBtnActive]}
          >
            <Ionicons name="mail-outline" size={15} color={mode === "otp" ? flavor.accent : P.muted} />
            <Text style={[styles.modeText, mode === "otp" && { color: flavor.accent }]}>Email OTP</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.alertError}>
            <Ionicons name="alert-circle" size={16} color={P.red} />
            <Text style={styles.alertErrorText}>{error}</Text>
          </View>
        ) : null}
        {info ? (
          <View style={styles.alertInfo}>
            <Ionicons name="checkmark-circle" size={16} color={P.green} />
            <Text style={styles.alertInfoText}>{info}</Text>
          </View>
        ) : null}

        <View style={styles.authCard}>
          <Text style={styles.inputLabel}>Portal Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="name@vaidyagogate.org"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          {mode === "password" ? (
            <>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                style={styles.input}
                onSubmitEditing={() => void signInPassword()}
              />
              <View style={{ marginTop: 14 }}>
                <ActionButton
                  label="Sign in to Production"
                  icon="log-in-outline"
                  color={flavor.accent}
                  loading={busy}
                  onPress={() => void signInPassword()}
                />
              </View>
            </>
          ) : (
            <>
              {otpSent ? (
                <>
                  <Text style={styles.inputLabel}>6-Digit Sign-In Code</Text>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="000000"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[styles.input, { letterSpacing: 6, fontSize: 18, fontWeight: "700", textAlign: "center" }]}
                  />
                  <View style={{ marginTop: 14, gap: 10 }}>
                    <ActionButton
                      label="Verify & Sign In"
                      icon="checkmark-circle-outline"
                      color={flavor.accent}
                      loading={busy}
                      onPress={() => void verifyOtp()}
                    />
                    <ActionButton
                      label="Resend Email Code"
                      variant="outline"
                      disabled={busy}
                      onPress={() => void requestOtp()}
                    />
                  </View>
                </>
              ) : (
                <View style={{ marginTop: 14 }}>
                  <ActionButton
                    label="Email Sign-In Code"
                    icon="send-outline"
                    color={flavor.accent}
                    loading={busy}
                    onPress={() => void requestOtp()}
                  />
                </View>
              )}
            </>
          )}
        </View>

        <Text style={styles.authFooter}>Connected securely to https://vaidyagogate.org</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Shared pure-white Order Card with Packed Balance Due indicator & quick WhatsApp/Email remind button */
export function PortalOrderCard({
  order,
  onPress,
  onRemind,
  reminding,
}: {
  order: PortalOrder;
  onPress: () => void;
  onRemind?: () => void;
  reminding?: boolean;
}) {
  const customer = order.deliveryAddress?.fullName || "Customer";
  const phone = order.deliveryAddress?.phone || "";
  const itemText = order.items.map((i) => `${i.title} × ${i.quantity}`).join(", ");
  const showRemind = order.balanceDue > 0 && order.status !== "Cancelled";

  return (
    <Pressable onPress={onPress} style={styles.orderCard}>
      <View style={styles.rowBetween}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <Text style={styles.orderId}>#{order.id}</Text>
          {order.channel === "pos" ? <StatusPill label="POS" tone="blue" /> : null}
        </View>
        <StatusPill label={order.status} tone={statusTone(order.status)} />
      </View>

      <Text style={styles.orderCustomer} numberOfLines={1}>
        {customer}{phone ? ` · ${phone}` : ""}
      </Text>
      <Text style={styles.orderItems} numberOfLines={2}>{itemText}</Text>

      <View style={[styles.rowBetween, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.orderTotal}>{formatINR(order.total)}</Text>
          <StatusPill label={order.paymentStatus} tone={statusTone(order.paymentStatus)} />
        </View>
        <Text style={styles.orderDate}>{formatShortDate(order.date)}</Text>
      </View>

      {showRemind ? (
        <View style={styles.dueStrip}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dueStripTitle}>Balance due: {formatINR(order.balanceDue)}</Text>
            <Text style={styles.dueStripSub} numberOfLines={1}>
              {order.balanceReminder?.lastAt
                ? `Last reminded ${formatShortDate(order.balanceReminder.lastAt)} (${order.balanceReminder.count}×)`
                : "Awaiting remaining payment before shipping"}
            </Text>
          </View>
          {onRemind ? (
            <ActionButton
              compact
              variant="amber"
              icon="notifications-outline"
              label={reminding ? "Sending…" : "Remind"}
              loading={reminding}
              onPress={onRemind}
            />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const STATUS_ACTIONS = ["Accepted", "Processing", "Packed", "Ready to Ship", "Shipped", "Delivered"];

/** Full pure-white Order Detail Modal with Animated Pipeline + Balance Due WhatsApp & Email Reminder */
export function OrderDetailModal({
  order,
  onClose,
  onUpdated,
  accent = P.brand,
}: {
  order: PortalOrder | null;
  onClose: () => void;
  onUpdated: (next: PortalOrder) => void;
  accent?: string;
}) {
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"ok" | "err">("ok");

  if (!order) return null;

  const triggerReminder = async (channels: ("whatsapp" | "email")[]) => {
    setBusy(channels.join("+"));
    setFeedback("");
    try {
      const res = await sendBalanceReminder({ orderId: order.id, channels });
      if (res.order) onUpdated(res.order);
      setFeedbackTone("ok");
      setFeedback(
        res.alreadyPaid
          ? "Customer already paid the balance link — marked Paid!"
          : `Reminder sent! WhatsApp: ${res.whatsapp} · Email: ${res.email}`
      );
    } catch (e) {
      setFeedbackTone("err");
      setFeedback((e as Error).message || "Could not send reminder.");
    } finally {
      setBusy("");
    }
  };

  const setStatus = async (status: string) => {
    setBusy(`st:${status}`);
    setFeedback("");
    try {
      const res = await updatePortalOrder({ orderId: order.id, status });
      if (res.order) onUpdated(res.order);
      setFeedbackTone("ok");
      setFeedback(`Order status updated to ${status}.`);
    } catch (e) {
      setFeedbackTone("err");
      setFeedback((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const markPaid = () => {
    Alert.alert(
      "Record balance paid?",
      `Mark remaining balance of ${formatINR(order.balanceDue)} as paid on order #${order.id}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Paid",
          onPress: async () => {
            setBusy("markPaid");
            try {
              const res = await updatePortalOrder({
                orderId: order.id,
                markBalancePaid: true,
                paymentMethod: "UPI / Counter",
              });
              if (res.order) onUpdated(res.order);
              setFeedbackTone("ok");
              setFeedback("Balance recorded as Paid. Ready for dispatch!");
            } catch (e) {
              setFeedbackTone("err");
              setFeedback((e as Error).message);
            } finally {
              setBusy("");
            }
          },
        },
      ]
    );
  };

  const addr = order.deliveryAddress;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top", "bottom"]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={21} color={P.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle}>Order #{order.id}</Text>
            <Text style={styles.topSub}>{formatShortDate(order.date)}</Text>
          </View>
          <StatusPill label={order.status} tone={statusTone(order.status)} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 32 }}>
          {feedback ? (
            <View style={feedbackTone === "ok" ? styles.alertInfo : styles.alertError}>
              <Ionicons
                name={feedbackTone === "ok" ? "checkmark-circle" : "alert-circle"}
                size={16}
                color={feedbackTone === "ok" ? P.green : P.red}
              />
              <Text style={feedbackTone === "ok" ? styles.alertInfoText : styles.alertErrorText}>{feedback}</Text>
            </View>
          ) : null}

          {/* Balance Due Reminder Card */}
          {order.balanceDue > 0 && order.status !== "Cancelled" ? (
            <View style={styles.balanceCard}>
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: P.amberSoft }]}>
                    <Ionicons name="wallet-outline" size={18} color={P.amber} />
                  </View>
                  <View>
                    <Text style={styles.balanceTitle}>Balance Due: {formatINR(order.balanceDue)}</Text>
                    <Text style={styles.balanceSub}>
                      Remind customer to pay so this parcel ships &amp; delivers soon
                    </Text>
                  </View>
                </View>
              </View>
              {order.balanceReminder?.lastAt ? (
                <Text style={styles.balanceMeta}>
                  Last reminded {formatShortDate(order.balanceReminder.lastAt)} via {order.balanceReminder.channels.join(" & ")} ({order.balanceReminder.count}×)
                </Text>
              ) : null}
              <View style={{ marginTop: 12, gap: 8 }}>
                <ActionButton
                  variant="amber"
                  icon="notifications"
                  label="Send Balance Reminder (WhatsApp + Email)"
                  loading={busy === "whatsapp+email"}
                  disabled={Boolean(busy)}
                  onPress={() => void triggerReminder(["whatsapp", "email"])}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <ActionButton
                      compact
                      variant="outline"
                      icon="logo-whatsapp"
                      label="WhatsApp Only"
                      loading={busy === "whatsapp"}
                      disabled={Boolean(busy)}
                      onPress={() => void triggerReminder(["whatsapp"])}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ActionButton
                      compact
                      variant="outline"
                      icon="mail-outline"
                      label="Email Only"
                      loading={busy === "email"}
                      disabled={Boolean(busy)}
                      onPress={() => void triggerReminder(["email"])}
                    />
                  </View>
                </View>
                <ActionButton
                  compact
                  variant="green"
                  icon="checkmark-done-outline"
                  label={`Record Balance Paid (${formatINR(order.balanceDue)})`}
                  loading={busy === "markPaid"}
                  disabled={Boolean(busy)}
                  onPress={markPaid}
                />
              </View>
            </View>
          ) : null}

          {/* Customer & Address */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Customer &amp; Delivery</Text>
            <Text style={styles.bodyStrong}>{addr?.fullName || "Customer"}</Text>
            {addr?.phone ? <Text style={styles.bodyMuted}>Phone: {addr.phone}</Text> : null}
            {addr?.email ? <Text style={styles.bodyMuted}>Email: {addr.email}</Text> : null}
            <Text style={[styles.bodyMuted, { marginTop: 4 }]}>
              {order.deliveryMode === "store_pickup"
                ? "Store Pickup at VGMF Counter"
                : [addr?.line1, addr?.landmark, addr?.city, addr?.state, addr?.pincode].filter(Boolean).join(", ")}
            </Text>
          </View>

          {/* Items & Payment */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Items ({order.items.length})</Text>
              <StatusPill label={order.paymentStatus} tone={statusTone(order.paymentStatus)} />
            </View>
            {order.items.map((item, idx) => (
              <View key={`${item.bookId}-${idx}`} style={styles.lineItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bodyStrong}>{item.title}</Text>
                  <Text style={styles.bodyMuted}>
                    Qty {item.quantity} × {formatINR(item.price)}
                    {item.sku ? ` · SKU ${item.sku}` : ""}
                  </Text>
                </View>
                <Text style={styles.bodyStrong}>{formatINR(item.price * item.quantity)}</Text>
              </View>
            ))}
            <View style={styles.totalsBox}>
              <View style={styles.rowBetween}>
                <Text style={styles.bodyMuted}>Total</Text>
                <Text style={styles.orderTotal}>{formatINR(order.total)}</Text>
              </View>
              {order.preorderPayment ? (
                <View style={styles.rowBetween}>
                  <Text style={styles.bodyMuted}>Advance / Balance</Text>
                  <Text style={styles.bodyStrong}>
                    {formatINR(order.preorderPayment.advance)} / {formatINR(order.preorderPayment.balance)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Animated Tracking Pipeline */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order Progress</Text>
            <View style={{ marginTop: 8 }}>
              {(() => {
                const pickup = order.deliveryMode === "store_pickup";
                const names = pickup
                  ? ["Ordered", "Packed", "Delivered"]
                  : ["Ordered", "Packed", "Shipped", "Out for Delivery", "Delivered"];
                const st = order.status.toLowerCase();
                let current = 0;
                if (st.includes("deliver")) current = names.length - 1;
                else if (st.includes("out for")) current = Math.min(names.length - 1, 3);
                else if (st.includes("ship")) current = Math.min(names.length - 1, 2);
                else if (st.includes("pack") || st.includes("ready")) current = 1;
                const stages: TrackStage[] = names.map((label, idx) => ({
                  id: label.toLowerCase(),
                  label,
                  reached: idx <= current,
                }));
                const courier = order.courierName || order.shipment?.courier;
                const awb = order.trackingId || order.shipment?.awb;
                return (
                  <Pipeline
                    stages={stages}
                    current={current}
                    failed={st === "cancelled" || st === "failed"}
                    expected={order.shipment?.expectedBy || order.eta}
                    shippedWith={courier ? `Courier: ${courier}${awb ? ` · AWB: ${awb}` : ""}` : undefined}
                  />
                );
              })()}
            </View>
          </View>

          {/* Quick Status Update */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Update Stage</Text>
            <View style={styles.chipGrid}>
              {STATUS_ACTIONS.map((st) => {
                const active = order.status === st;
                return (
                  <Pressable
                    key={st}
                    disabled={Boolean(busy) || active}
                    onPress={() => void setStatus(st)}
                    style={[
                      styles.stageChip,
                      active && { backgroundColor: accent, borderColor: accent },
                    ]}
                  >
                    <Text style={[styles.stageChipText, active && { color: P.white }]}>{st}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Recent History */}
          {order.history?.length ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Activity Log</Text>
              {order.history.slice(-6).reverse().map((h, i) => (
                <View key={i} style={styles.histRow}>
                  <View style={styles.histDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bodyStrong}>{h.status}</Text>
                    {h.note ? <Text style={styles.bodyMuted}>{h.note}</Text> : null}
                    <Text style={styles.orderDate}>
                      {formatShortDate(h.at)}{h.by ? ` · ${h.by}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const SCANNER_HTML = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
  html,body{margin:0;padding:0;background:#fff;font-family:-apple-system,Roboto,sans-serif;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#111827;}
  .wrap{position:relative;width:100%;max-width:420px;aspect-ratio:1/1;background:#F3F4F6;border-radius:18px;overflow:hidden;border:2px solid #E5E7EB;}
  video{width:100%;height:100%;object-fit:cover;}
  .frame{position:absolute;inset:18%;border:3px solid #067D62;border-radius:16px;box-shadow:0 0 0 9999px rgba(255,255,255,0.45);}
  .torch-btn{position:absolute;right:12px;bottom:12px;z-index:5;background:rgba(255,255,255,0.95);color:#111827;border:1px solid #D1D5DB;border-radius:999px;padding:8px 13px;font-size:12px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.12);}
  .torch-btn.on{background:#FEF3C7;border-color:#F59E0B;color:#B45309;}
  .msg{margin-top:14px;font-size:13px;color:#4B5563;text-align:center;padding:0 16px;}
</style>
</head>
<body>
<div class="wrap">
  <video id="v" autoplay playsinline muted></video>
  <div class="frame"></div>
  <button id="tbtn" class="torch-btn" type="button" onclick="window.toggleTorch()">🔦 Torch OFF</button>
</div>
<div id="m" class="msg">Point camera at QR code or barcode…</div>
<script>
var videoTrack = null;
var torchOn = false;
window.setTorch = async function(on) {
  const m = document.getElementById('m');
  const btn = document.getElementById('tbtn');
  if (!videoTrack) {
    m.textContent = 'Start camera first to use torch.';
    return;
  }
  try {
    await videoTrack.applyConstraints({ advanced: [{ torch: Boolean(on) }] });
    torchOn = Boolean(on);
    btn.className = torchOn ? 'torch-btn on' : 'torch-btn';
    btn.textContent = torchOn ? '🔦 Torch ON' : '🔦 Torch OFF';
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ __torch: torchOn }));
  } catch (e) {
    m.textContent = 'Torch not supported by this camera WebView.';
  }
};
window.toggleTorch = function() { window.setTorch(!torchOn); };
(async function(){
  const m = document.getElementById('m');
  const v = document.getElementById('v');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
    v.srcObject = stream;
    videoTrack = stream.getVideoTracks()[0] || null;
    if (!('BarcodeDetector' in window)) {
      m.textContent = 'Camera ready. Use the code box below if auto-detect is unavailable on this Android WebView.';
      return;
    }
    const detector = new BarcodeDetector({ formats: ['qr_code','code_128','ean_13','ean_8','upc_a','code_39'] });
    let last = '';
    setInterval(async () => {
      try {
        const codes = await detector.detect(v);
        if (codes && codes.length && codes[0].rawValue && codes[0].rawValue !== last) {
          last = codes[0].rawValue;
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(last);
        }
      } catch(e){}
    }, 350);
  } catch(err) {
    m.textContent = 'Camera permission needed — or type/scan with Bluetooth scanner below.';
  }
})();
</script>
</body>
</html>`;

/** Clean pure-white Camera + Torch + Bluetooth/Manual Barcode & QR Scanner Modal */
export function BarcodeScannerModal({
  visible,
  title = "Scan Barcode / QR",
  hint = "Scan with phone camera, Torch, Bluetooth scanner, or type SKU / Order ID",
  onClose,
  onScanned,
}: {
  visible: boolean;
  title?: string;
  hint?: string;
  onClose: () => void;
  onScanned: (code: string) => void;
}) {
  const [manual, setManual] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const webRef = useRef<WebView | null>(null);

  const toggleTorch = () => {
    const next = !torchOn;
    setTorchOn(next);
    webRef.current?.injectJavaScript(`window.setTorch && window.setTorch(${next ? "true" : "false"}); true;`);
  };

  const submitManual = () => {
    const clean = manual.trim();
    if (!clean) return;
    setManual("");
    onScanned(clean);
  };

  const handleClose = () => {
    setTorchOn(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: P.white }} edges={["top", "bottom"]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={handleClose} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={P.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Text style={styles.topSub}>{hint}</Text>
          </View>
          <Pressable
            onPress={toggleTorch}
            style={[
              styles.iconBtn,
              { width: "auto", paddingHorizontal: 11, flexDirection: "row", gap: 5 },
              torchOn && { backgroundColor: P.amberSoft, borderColor: "#F59E0B" },
            ]}
            accessibilityLabel="Toggle flashlight torch"
          >
            <Ionicons name={torchOn ? "flashlight" : "flashlight-outline"} size={18} color={torchOn ? P.amber : P.ink} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: torchOn ? P.amber : P.ink }}>{torchOn ? "Torch ON" : "Torch"}</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1, padding: 16 }}>
          <View style={{ flex: 1, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: P.border }}>
            <WebView
              ref={webRef}
              originWhitelist={["*"]}
              source={{ html: SCANNER_HTML, baseUrl: "https://vaidyagogate.org" }}
              javaScriptEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              onMessage={(ev) => {
                const raw = String(ev.nativeEvent.data || "").trim();
                if (!raw) return;
                if (raw.startsWith("{")) {
                  try {
                    const parsed = JSON.parse(raw) as { __torch?: boolean };
                    if (typeof parsed.__torch === "boolean") {
                      setTorchOn(parsed.__torch);
                      return;
                    }
                  } catch {
                    /* fall through */
                  }
                }
                setTorchOn(false);
                onScanned(raw);
              }}
            />
          </View>
          <View style={{ marginTop: 14, flexDirection: "row", gap: 8 }}>
            <TextInput
              value={manual}
              onChangeText={setManual}
              placeholder="Scan or type Order ID / SKU / Barcode"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitManual}
              style={[styles.input, { flex: 1, marginTop: 0 }]}
            />
            <ActionButton compact variant="green" icon="checkmark" label="Submit" onPress={submitManual} />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: P.white,
    borderBottomWidth: 1,
    borderBottomColor: P.border,
  },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, marginRight: 8 },
  logoRing: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: P.white,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: { width: 26, height: 26 },
  topTitle: { fontSize: 16, fontWeight: "800", color: P.ink },
  topSub: { fontSize: 11.5, color: P.muted, marginTop: 1 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: P.greenSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P.green },
  liveText: { fontSize: 9.5, fontWeight: "800", color: P.green },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: P.border,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: P.white,
    borderTopWidth: 1,
    borderTopColor: P.border,
    paddingTop: 6,
    paddingBottom: Platform.OS === "android" ? 8 : 16,
    paddingHorizontal: 6,
  },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabPill: {
    minWidth: 46,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabLabel: { fontSize: 10.5, fontWeight: "700", color: P.muted, marginTop: 2 },
  tabBadge: {
    position: "absolute",
    top: -3,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeText: { fontSize: 9.5, fontWeight: "800", color: P.white },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: "700" },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: P.white,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: P.border,
  },
  kpiIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiValue: { fontSize: 21, fontWeight: "800", color: P.ink },
  kpiLabel: { fontSize: 12, fontWeight: "600", color: P.muted, marginTop: 2 },
  kpiHint: { fontSize: 11, color: P.amber, fontWeight: "600", marginTop: 3 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  sectionTitle: { fontSize: 15.5, fontWeight: "800", color: P.ink },
  sectionSub: { fontSize: 12, color: P.muted, marginTop: 1 },
  sectionBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 4, paddingHorizontal: 6 },
  sectionBtnText: { fontSize: 12.5, fontWeight: "700", color: P.brand },
  emptyBox: {
    backgroundColor: P.white,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: P.border,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: P.ink },
  emptySub: { fontSize: 12.5, color: P.muted, textAlign: "center", marginTop: 4 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnCompact: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 10 },
  btnText: { fontSize: 14, fontWeight: "700" },
  btnTextCompact: { fontSize: 12.5 },
  authWrap: { flexGrow: 1, padding: 22, justifyContent: "center", backgroundColor: P.white },
  authLogoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
    elevation: 2,
  },
  authPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  authPillText: { fontSize: 11.5, fontWeight: "700" },
  authTitle: { fontSize: 23, fontWeight: "800", color: P.ink, textAlign: "center" },
  authSub: { fontSize: 13, color: P.muted, textAlign: "center", marginTop: 4, marginBottom: 18 },
  modeSwitch: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  modeBtnActive: { backgroundColor: P.white, elevation: 1 },
  modeText: { fontSize: 13, fontWeight: "700", color: P.muted },
  authCard: {
    backgroundColor: P.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: P.border,
  },
  inputLabel: { fontSize: 12, fontWeight: "700", color: "#374151", marginTop: 10, marginBottom: 5 },
  input: {
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14.5,
    color: P.ink,
  },
  alertError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: P.redSoft,
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 11,
    marginBottom: 10,
  },
  alertErrorText: { flex: 1, fontSize: 12.5, color: P.red, fontWeight: "600" },
  alertInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: P.greenSoft,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 11,
    marginBottom: 10,
  },
  alertInfoText: { flex: 1, fontSize: 12.5, color: P.green, fontWeight: "600" },
  authFooter: { fontSize: 11.5, color: "#9CA3AF", textAlign: "center", marginTop: 20 },
  orderCard: {
    backgroundColor: P.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: P.border,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  orderId: { fontSize: 14, fontWeight: "800", color: P.ink },
  orderCustomer: { fontSize: 13.5, fontWeight: "700", color: "#1F2937", marginTop: 5 },
  orderItems: { fontSize: 12.5, color: P.muted, marginTop: 3, lineHeight: 18 },
  orderTotal: { fontSize: 15.5, fontWeight: "800", color: P.ink },
  orderDate: { fontSize: 11.5, color: "#9CA3AF" },
  dueStrip: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dueStripTitle: { fontSize: 12.5, fontWeight: "800", color: P.amber },
  dueStripSub: { fontSize: 11, color: "#92400E", marginTop: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: P.white,
    borderBottomWidth: 1,
    borderBottomColor: P.border,
  },
  modalTitle: { fontSize: 16.5, fontWeight: "800", color: P.ink },
  balanceCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  balanceTitle: { fontSize: 15.5, fontWeight: "800", color: P.amber },
  balanceSub: { fontSize: 12, color: "#92400E", marginTop: 1 },
  balanceMeta: { fontSize: 11.5, color: "#92400E", marginTop: 8, fontWeight: "600" },
  card: {
    backgroundColor: P.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: P.border,
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: P.ink, marginBottom: 8 },
  bodyStrong: { fontSize: 13.5, fontWeight: "700", color: P.ink },
  bodyMuted: { fontSize: 12.5, color: P.muted, lineHeight: 18 },
  lineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  totalsBox: { marginTop: 10, gap: 4 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stageChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.white,
  },
  stageChipText: { fontSize: 12.5, fontWeight: "700", color: P.ink },
  histRow: { flexDirection: "row", gap: 10, paddingVertical: 6 },
  histDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: P.green, marginTop: 5 },
});
