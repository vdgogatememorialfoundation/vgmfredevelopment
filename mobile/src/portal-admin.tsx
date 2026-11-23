import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { ADMIN_NAV_GROUPS } from "./admin-pages";
import { DEFAULT_API } from "./host";
import {
  fetchPortalDashboard,
  fetchPortalOrders,
  fetchPortalTickets,
  formatINR,
  formatShortDate,
  replyPortalTicket,
  sendBalanceReminder,
  type PortalMetrics,
  type PortalOrder,
  type PortalSession,
  type PortalTicket,
} from "./portal-api";
import {
  ActionButton,
  EmptyBox,
  KpiCard,
  OrderDetailModal,
  P,
  PortalOrderCard,
  PortalTabBar,
  PortalTopBar,
  SectionHeader,
  StatusPill,
  statusTone,
  styles,
} from "./portal-ui";

const ORDER_FILTERS = [
  { id: "all", label: "All" },
  { id: "packed_unpaid", label: "Packed · Due" },
  { id: "packed", label: "Packed" },
  { id: "to_pack", label: "To Pack" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "pos", label: "Store POS" },
  { id: "cancelled", label: "Cancelled" },
];

const QUICK_ADMIN_SHORTCUTS = [
  { label: "Mobile App & Notifs", href: "/admin/settings/mobile", icon: "notifications-outline", accent: P.brand, bg: P.brandSoft },
  { label: "Payments & Razorpay", href: "/admin/settings/payments", icon: "card-outline", accent: P.green, bg: P.greenSoft },
  { label: "WhatsApp Settings", href: "/admin/settings/whatsapp", icon: "logo-whatsapp", accent: P.green, bg: P.greenSoft },
  { label: "Shipping APIs", href: "/admin/settings/shipping-apis", icon: "airplane-outline", accent: P.blue, bg: P.blueSoft },
  { label: "Homepage & Tagline", href: "/admin/website/homepage", icon: "home-outline", accent: P.amber, bg: P.amberSoft },
  { label: "WhatsApp Inbox", href: "/admin/support/whatsapp", icon: "chatbubbles-outline", accent: P.green, bg: P.greenSoft },
  { label: "Products & Stock", href: "/admin/commerce/products", icon: "book-outline", accent: P.brand, bg: P.brandSoft },
  { label: "General Settings", href: "/admin/settings", icon: "settings-outline", accent: P.ink, bg: "#F3F4F6" },
];

/** Builds an injection script that auto-authenticates the admin inside vaidyagogate.org/admin WebViews. */
function buildAdminSessionInjectJs(session: PortalSession) {
  const userObj = {
    id: session.email,
    email: session.email,
    role: session.role || "admin",
    firstName: session.firstName || session.name.split(" ")[0] || "Admin",
    lastName: session.lastName || session.name.split(" ").slice(1).join(" ") || "",
    name: session.name || session.email,
    staffRoleId: session.staffRoleId,
  };
  const serialized = JSON.stringify(userObj);
  const encoded = encodeURIComponent(serialized);
  return `
    (function(){
      try {
        var raw = ${JSON.stringify(serialized)};
        localStorage.setItem("vgmf_admin_session", raw);
        localStorage.removeItem("vgmf_signed_out_portal");
        document.cookie = "vgmf_admin_session=${encoded}; Path=/; SameSite=Lax; Max-Age=34560000; Secure";
      } catch (e) {}
    })();
    true;
  `;
}

function buildAdminCookieHeader(session: PortalSession) {
  const userObj = {
    id: session.email,
    email: session.email,
    role: session.role || "admin",
    firstName: session.firstName || session.name.split(" ")[0] || "Admin",
    lastName: session.lastName || session.name.split(" ").slice(1).join(" ") || "",
    name: session.name || session.email,
    staffRoleId: session.staffRoleId,
  };
  return `vgmf_admin_session=${encodeURIComponent(JSON.stringify(userObj))}`;
}

export function AdminAppShell({ session, onSignOut }: { session: PortalSession; onSignOut: () => void }) {
  const [tab, setTab] = useState("dashboard");
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<PortalMetrics | null>(null);
  const [packedUnpaid, setPackedUnpaid] = useState<PortalOrder[]>([]);
  const [recentOrders, setRecentOrders] = useState<PortalOrder[]>([]);
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [orderFilter, setOrderFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [tickets, setTickets] = useState<PortalTicket[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PortalOrder | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<PortalTicket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [remindingId, setRemindingId] = useState("");
  const [bulkReminding, setBulkReminding] = useState(false);
  const [toast, setToast] = useState("");

  // All Admin Pages & Settings directory + in-app auto-signed-in viewer
  const [pageQuery, setPageQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [webPage, setWebPage] = useState<{ title: string; href: string } | null>(null);
  const [webLoading, setWebLoading] = useState(false);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const webRef = useRef<WebView | null>(null);

  const adminInjectJs = useMemo(() => buildAdminSessionInjectJs(session), [session]);
  const adminCookie = useMemo(() => buildAdminCookieHeader(session), [session]);

  const loadDashboard = useCallback(async () => {
    const data = await fetchPortalDashboard();
    setMetrics(data.metrics);
    setPackedUnpaid(data.packedUnpaid);
    setRecentOrders(data.recentOrders);
  }, []);

  const loadOrders = useCallback(async (f = orderFilter, q = search) => {
    const data = await fetchPortalOrders(f, q);
    setOrders(data.orders);
  }, [orderFilter, search]);

  const loadTickets = useCallback(async () => {
    const data = await fetchPortalTickets();
    setTickets(data.tickets);
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadDashboard(), loadOrders(orderFilter, search), loadTickets()]);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboard, loadOrders, loadTickets, orderFilter, search]);

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    if (tab === "orders") void loadOrders(orderFilter, search);
  }, [tab, orderFilter]);

  const remindOne = async (order: PortalOrder) => {
    setRemindingId(order.id);
    setToast("");
    try {
      const res = await sendBalanceReminder({ orderId: order.id, channels: ["whatsapp", "email"] });
      setToast(
        res.alreadyPaid
          ? `#${order.id} already paid! Marked Paid.`
          : `Fresh 2-day balance link & reminder sent for #${order.id} (WA: ${res.whatsapp}, Email: ${res.email})`
      );
      await refreshAll();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setRemindingId("");
    }
  };

  const remindAllPacked = () => {
    if (!packedUnpaid.length) return;
    Alert.alert(
      "Remind all packed unpaid orders?",
      `Send WhatsApp & Email balance due reminders (with fresh 2-day Razorpay links) to all ${packedUnpaid.length} packed order(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send All",
          onPress: async () => {
            setBulkReminding(true);
            setToast("");
            try {
              const res = await sendBalanceReminder({ allPackedUnpaid: true, channels: ["whatsapp", "email"] });
              setToast(`Balance reminders sent via WhatsApp & Email to ${res.sentCount}/${res.total} packed orders.`);
              await refreshAll();
            } catch (e) {
              setToast((e as Error).message);
            } finally {
              setBulkReminding(false);
            }
          },
        },
      ]
    );
  };

  const applyOrderUpdate = (next: PortalOrder) => {
    setSelectedOrder(next);
    setOrders((prev) => prev.map((o) => (o.id === next.id ? next : o)));
    setRecentOrders((prev) => prev.map((o) => (o.id === next.id ? next : o)));
    setPackedUnpaid((prev) =>
      next.isPackedUnpaid ? prev.map((o) => (o.id === next.id ? next : o)) : prev.filter((o) => o.id !== next.id)
    );
  };

  const sendTicketReply = async (newStatus?: string) => {
    if (!selectedTicket) return;
    if (!replyText.trim() && !newStatus) return;
    try {
      const res = await replyPortalTicket({
        ticketId: selectedTicket.id,
        text: replyText.trim() || undefined,
        status: newStatus,
      });
      setReplyText("");
      setSelectedTicket(res.ticket);
      setTickets((prev) => prev.map((t) => (t.id === res.ticket.id ? res.ticket : t)));
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  const filteredGroups = useMemo(() => {
    const q = pageQuery.trim().toLowerCase();
    return ADMIN_NAV_GROUPS.filter((g) => groupFilter === "all" || g.id === groupFilter)
      .map((g) => ({
        ...g,
        items: q
          ? g.items.filter(
              (item) =>
                item.label.toLowerCase().includes(q) ||
                item.href.toLowerCase().includes(q) ||
                g.label.toLowerCase().includes(q)
            )
          : g.items,
      }))
      .filter((g) => g.items.length > 0);
  }, [pageQuery, groupFilter]);

  const totalAdminPages = useMemo(
    () => ADMIN_NAV_GROUPS.reduce((sum, g) => sum + g.items.length, 0),
    []
  );

  const openAdminPage = (label: string, href: string) => {
    setWebLoading(true);
    setWebPage({ title: label, href });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.white }} edges={["top"]}>
      <PortalTopBar
        title="VGMF Admin"
        subtitle={`${session.name} · Full Admin Console`}
        accent={P.brand}
        refreshing={refreshing}
        onRefresh={() => void refreshAll()}
        rightAction={
          <Pressable
            onPress={() => { setGroupFilter("settings"); setTab("alladmin"); }}
            style={[styles.iconBtn, { backgroundColor: P.brandSoft, borderColor: "#F5D0D5" }]}
            accessibilityLabel="Admin Settings"
          >
            <Ionicons name="settings-outline" size={19} color={P.brand} />
          </Pressable>
        }
      />

      {toast ? (
        <Pressable
          onPress={() => setToast("")}
          style={{ backgroundColor: P.greenSoft, paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#A7F3D0", flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Ionicons name="checkmark-circle" size={16} color={P.green} />
          <Text style={{ flex: 1, fontSize: 12.5, fontWeight: "600", color: P.green }}>{toast}</Text>
          <Ionicons name="close" size={16} color={P.green} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1, backgroundColor: P.bg }}>
        {tab === "dashboard" ? (
          <ScrollView
            contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 28 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshAll()} tintColor={P.brand} />}
          >
            {packedUnpaid.length > 0 ? (
              <View style={styles.balanceCard}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.balanceTitle}>
                      {packedUnpaid.length} Packed Order{packedUnpaid.length === 1 ? "" : "s"} Awaiting Balance
                    </Text>
                    <Text style={styles.balanceSub}>
                      {formatINR(metrics?.packedUnpaidAmount)} total due · Renews 2-day Razorpay link + WhatsApp &amp; Email
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <ActionButton
                      compact
                      variant="amber"
                      icon="notifications"
                      label={bulkReminding ? "Sending…" : "Remind All (WA + Email)"}
                      loading={bulkReminding}
                      onPress={remindAllPacked}
                    />
                  </View>
                  <ActionButton compact variant="outline" label="View List" onPress={() => setTab("packed")} />
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <KpiCard
                icon="cash-outline"
                label="Today Revenue"
                value={formatINR(metrics?.todayRevenue)}
                hint={`${metrics?.todayOrders ?? 0} order(s) today`}
                accent={P.green}
                bg={P.greenSoft}
                onPress={() => { setOrderFilter("all"); setTab("orders"); }}
              />
              <KpiCard
                icon="archive-outline"
                label="Packed · Due"
                value={metrics?.packedUnpaidCount ?? 0}
                hint={formatINR(metrics?.packedUnpaidAmount)}
                accent={P.amber}
                bg={P.amberSoft}
                onPress={() => setTab("packed")}
              />
              <KpiCard
                icon="cube-outline"
                label="To Pick / Pack"
                value={`${metrics?.pendingPick ?? 0} / ${metrics?.readyToPack ?? 0}`}
                hint={`${metrics?.packedCount ?? 0} packed total`}
                accent={P.brand}
                bg={P.brandSoft}
                onPress={() => openAdminPage("Assign pickers & packing board", "/admin/commerce/picking")}
              />
              <KpiCard
                icon="airplane-outline"
                label="In Transit"
                value={metrics?.shippedCount ?? 0}
                hint={`${metrics?.deliveredCount ?? 0} delivered`}
                accent={P.blue}
                bg={P.blueSoft}
                onPress={() => { setOrderFilter("shipped"); setTab("orders"); }}
              />
              <KpiCard
                icon="storefront-outline"
                label="Store POS Today"
                value={formatINR(metrics?.posSalesTodayAmount)}
                hint={`${metrics?.posSalesTodayCount ?? 0} counter sale(s)`}
                accent={P.brand}
                bg={P.brandSoft}
                onPress={() => openAdminPage("In-store POS", "/admin/commerce/pos")}
              />
              <KpiCard
                icon="chatbubbles-outline"
                label="Open Tickets"
                value={metrics?.openTickets ?? 0}
                hint={`${metrics?.totalOrders ?? 0} total orders`}
                accent={P.green}
                bg={P.greenSoft}
                onPress={() => setTicketsOpen(true)}
              />
            </View>

            {/* Quick Admin Settings & Tools */}
            <SectionHeader
              title="Quick Admin Settings & Pages"
              subtitle={`All ${totalAdminPages} pages from vaidyagogate.org/admin inside this app`}
              actionLabel="All Pages"
              onAction={() => { setGroupFilter("all"); setTab("alladmin"); }}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
              {QUICK_ADMIN_SHORTCUTS.map((item) => (
                <Pressable
                  key={item.href}
                  onPress={() => openAdminPage(item.label, item.href)}
                  style={{
                    width: "48.3%",
                    backgroundColor: P.white,
                    borderRadius: 14,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: P.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: item.bg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={item.icon as never} size={18} color={item.accent} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 12.5, fontWeight: "700", color: P.ink }} numberOfLines={2}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <SectionHeader
              title="Recent Live Orders"
              subtitle="Tap any order to inspect pipeline, status, or send reminders"
              actionLabel="All Orders"
              onAction={() => setTab("orders")}
            />

            {recentOrders.length ? (
              recentOrders.map((o) => (
                <PortalOrderCard
                  key={o.id}
                  order={o}
                  onPress={() => setSelectedOrder(o)}
                  onRemind={o.balanceDue > 0 ? () => void remindOne(o) : undefined}
                  reminding={remindingId === o.id}
                />
              ))
            ) : (
              <EmptyBox icon="cube-outline" title="No orders yet" subtitle="Pull down to refresh from vaidyagogate.org" />
            )}
          </ScrollView>
        ) : null}

        {tab === "orders" ? (
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: P.white, padding: 12, borderBottomWidth: 1, borderBottomColor: P.border, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F3F4F6", borderRadius: 11, paddingHorizontal: 11 }}>
                <Ionicons name="search" size={18} color={P.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search order ID, customer, phone, AWB…"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="search"
                  onSubmitEditing={() => void loadOrders(orderFilter, search)}
                  style={{ flex: 1, paddingVertical: 9, fontSize: 14, color: P.ink }}
                />
                {search ? (
                  <Pressable onPress={() => { setSearch(""); void loadOrders(orderFilter, ""); }}>
                    <Ionicons name="close-circle" size={18} color={P.muted} />
                  </Pressable>
                ) : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                {ORDER_FILTERS.map((f) => {
                  const active = orderFilter === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => { setOrderFilter(f.id); void loadOrders(f.id, search); }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: active ? P.brand : "#F3F4F6",
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: active ? P.white : "#374151" }}>
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 28 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadOrders(orderFilter, search)} tintColor={P.brand} />}
            >
              <ActionButton
                compact
                variant="outline"
                icon="open-outline"
                label="Open Full Web Orders Console (Labels, Couriers, Split, Refunds)"
                onPress={() => openAdminPage("Orders Console", "/admin/commerce/orders")}
              />
              {orders.length ? (
                orders.map((o) => (
                  <PortalOrderCard
                    key={o.id}
                    order={o}
                    onPress={() => setSelectedOrder(o)}
                    onRemind={o.balanceDue > 0 ? () => void remindOne(o) : undefined}
                    reminding={remindingId === o.id}
                  />
                ))
              ) : (
                <EmptyBox icon="search-outline" title="No matching orders" subtitle="Try another status chip or search term." />
              )}
            </ScrollView>
          </View>
        ) : null}

        {tab === "packed" ? (
          <ScrollView
            contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 28 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshAll()} tintColor={P.brand} />}
          >
            <View style={styles.balanceCard}>
              <Text style={styles.balanceTitle}>Packed Orders · Balance Payment Reminders</Text>
              <Text style={[styles.balanceSub, { marginTop: 4 }]}>
                Automatically renews expired 2-day Razorpay links and sends WhatsApp &amp; Email reminders so parcels ship &amp; deliver soon.
              </Text>
              {packedUnpaid.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <ActionButton
                    variant="amber"
                    icon="notifications"
                    label={bulkReminding ? "Sending Reminders…" : `Remind All ${packedUnpaid.length} Customers (WhatsApp + Email)`}
                    loading={bulkReminding}
                    onPress={remindAllPacked}
                  />
                </View>
              ) : null}
            </View>

            {packedUnpaid.length ? (
              packedUnpaid.map((o) => (
                <PortalOrderCard
                  key={o.id}
                  order={o}
                  onPress={() => setSelectedOrder(o)}
                  onRemind={() => void remindOne(o)}
                  reminding={remindingId === o.id}
                />
              ))
            ) : (
              <EmptyBox
                icon="checkmark-done-circle-outline"
                title="All packed orders are fully paid!"
                subtitle="No pending balance payments on packed parcels right now."
              />
            )}
          </ScrollView>
        ) : null}

        {/* ALL 86 ADMIN PAGES & ALL 20 SETTINGS PAGES */}
        {tab === "alladmin" ? (
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: P.white, padding: 12, borderBottomWidth: 1, borderBottomColor: P.border, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F3F4F6", borderRadius: 11, paddingHorizontal: 11 }}>
                <Ionicons name="search" size={18} color={P.muted} />
                <TextInput
                  value={pageQuery}
                  onChangeText={setPageQuery}
                  placeholder={`Search all ${totalAdminPages} admin pages & settings…`}
                  placeholderTextColor="#9CA3AF"
                  style={{ flex: 1, paddingVertical: 9, fontSize: 14, color: P.ink }}
                />
                {pageQuery ? (
                  <Pressable onPress={() => setPageQuery("")}>
                    <Ionicons name="close-circle" size={18} color={P.muted} />
                  </Pressable>
                ) : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                <Pressable
                  onPress={() => setGroupFilter("all")}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: groupFilter === "all" ? P.brand : "#F3F4F6",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: groupFilter === "all" ? P.white : "#374151" }}>
                    All ({totalAdminPages})
                  </Text>
                </Pressable>
                {ADMIN_NAV_GROUPS.map((g) => {
                  const active = groupFilter === g.id;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => setGroupFilter(g.id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: active ? P.brand : "#F3F4F6",
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: active ? P.white : "#374151" }}>
                        {g.label} ({g.items.length})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 28 }}>
              <ActionButton
                compact
                variant="soft"
                color={P.green}
                icon="chatbubbles-outline"
                label={`Native Support Tickets Desk (${metrics?.openTickets ?? 0} open)`}
                onPress={() => setTicketsOpen(true)}
              />

              {filteredGroups.length ? (
                filteredGroups.map((group) => (
                  <View key={group.id} style={styles.card}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: group.bg, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={group.icon as never} size={17} color={group.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14.5, fontWeight: "800", color: P.ink }}>{group.label}</Text>
                        <Text style={styles.orderDate}>{group.items.length} page{group.items.length === 1 ? "" : "s"}</Text>
                      </View>
                    </View>

                    <View style={{ gap: 2 }}>
                      {group.items.map((item, idx) => (
                        <Pressable
                          key={item.href + idx}
                          onPress={() => openAdminPage(item.label, item.href)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingVertical: 11,
                            borderTopWidth: idx === 0 ? 0 : 1,
                            borderTopColor: "#F3F4F6",
                          }}
                        >
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={{ fontSize: 13.5, fontWeight: "700", color: P.ink }}>{item.label}</Text>
                            <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{item.href}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))
              ) : (
                <EmptyBox icon="search-outline" title="No matching admin page" subtitle="Try clearing your search filter." />
              )}
            </ScrollView>
          </View>
        ) : null}

        {tab === "account" ? (
          <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
            <View style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[styles.kpiIconWrap, { width: 48, height: 48, borderRadius: 24, backgroundColor: P.brandSoft, marginBottom: 0 }]}>
                  <Ionicons name="shield-checkmark" size={24} color={P.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{session.name}</Text>
                  <Text style={styles.bodyMuted}>{session.email}</Text>
                  <View style={{ alignSelf: "flex-start", marginTop: 4 }}>
                    <StatusPill label={session.role.toUpperCase()} tone="brand" />
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Complete Production Admin Access</Text>
              <Text style={styles.bodyStrong}>https://vaidyagogate.org/admin</Text>
              <Text style={styles.bodyMuted}>
                VGMF Admin v5.5.0 · All {totalAdminPages} Admin Pages &amp; All 20 Settings built in.
              </Text>
            </View>
            <ActionButton
              variant="soft"
              icon="settings-outline"
              label="Open Admin Settings (All 20)"
              onPress={() => { setGroupFilter("settings"); setTab("alladmin"); }}
            />
            <ActionButton variant="outline" icon="log-out-outline" label="Sign Out" onPress={onSignOut} />
          </ScrollView>
        ) : null}
      </View>

      <PortalTabBar
        accent={P.brand}
        active={tab}
        onSelect={setTab}
        tabs={[
          { id: "dashboard", label: "Dashboard", icon: "grid" },
          { id: "orders", label: "Orders", icon: "cube" },
          { id: "packed", label: "Packed Due", icon: "archive", badge: packedUnpaid.length },
          { id: "alladmin", label: "All Admin", icon: "settings" },
          { id: "account", label: "Account", icon: "person-circle" },
        ]}
      />

      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdated={applyOrderUpdate}
        accent={P.brand}
      />

      {/* Full Auto-Signed-In Admin Page Viewer Modal (Every /admin Page & Setting on vaidyagogate.org) */}
      <Modal visible={Boolean(webPage)} animationType="slide" onRequestClose={() => setWebPage(null)}>
        {webPage ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: P.white }} edges={["top", "bottom"]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setWebPage(null)} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={21} color={P.ink} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>{webPage.title}</Text>
                <Text style={styles.topSub} numberOfLines={1}>vaidyagogate.org{webPage.href}</Text>
              </View>
              <Pressable onPress={() => webRef.current?.reload()} style={styles.iconBtn}>
                {webLoading ? <ActivityIndicator size="small" color={P.brand} /> : <Ionicons name="refresh" size={19} color={P.ink} />}
              </Pressable>
            </View>
            <WebView
              ref={webRef}
              source={{
                uri: `${DEFAULT_API}${webPage.href}`,
                headers: { Cookie: adminCookie },
              }}
              injectedJavaScriptBeforeContentLoaded={adminInjectJs}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              allowFileAccess
              onLoadStart={() => setWebLoading(true)}
              onLoadEnd={() => setWebLoading(false)}
              style={{ flex: 1, backgroundColor: P.white }}
            />
          </SafeAreaView>
        ) : null}
      </Modal>

      {/* Native Support Tickets List Modal */}
      <Modal visible={ticketsOpen} animationType="slide" onRequestClose={() => setTicketsOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setTicketsOpen(false)} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={21} color={P.ink} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Support Tickets ({tickets.length})</Text>
              <Text style={styles.topSub}>Tap any ticket to reply or resolve</Text>
            </View>
            <Pressable onPress={() => void loadTickets()} style={styles.iconBtn}>
              <Ionicons name="refresh" size={19} color={P.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 28 }}>
            {tickets.length ? (
              tickets.map((t) => (
                <Pressable key={t.id} onPress={() => setSelectedTicket(t)} style={styles.orderCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.orderId}>#{t.id}</Text>
                    <StatusPill label={t.status} tone={statusTone(t.status)} />
                  </View>
                  <Text style={styles.orderCustomer} numberOfLines={1}>{t.subject}</Text>
                  <Text style={styles.orderItems} numberOfLines={2}>{t.body}</Text>
                  <View style={[styles.rowBetween, { marginTop: 8 }]}>
                    <Text style={styles.orderDate}>{t.name} · {t.email}</Text>
                    <Text style={styles.orderDate}>{formatShortDate(t.createdAt)}</Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <EmptyBox icon="chatbubbles-outline" title="No support tickets" subtitle="Customer tickets appear here." />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Ticket Reply Modal */}
      <Modal visible={Boolean(selectedTicket)} animationType="slide" onRequestClose={() => setSelectedTicket(null)}>
        {selectedTicket ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top", "bottom"]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setSelectedTicket(null)} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={21} color={P.ink} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>Ticket #{selectedTicket.id}</Text>
                <Text style={styles.topSub}>{selectedTicket.name} · {selectedTicket.email}</Text>
              </View>
              <StatusPill label={selectedTicket.status} tone={statusTone(selectedTicket.status)} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{selectedTicket.subject}</Text>
                <Text style={styles.bodyMuted}>{selectedTicket.body}</Text>
              </View>
              {(selectedTicket.responses ?? []).map((r, idx) => (
                <View key={idx} style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.bodyStrong}>{r.from}</Text>
                    <Text style={styles.orderDate}>{formatShortDate(r.at)}</Text>
                  </View>
                  <Text style={[styles.bodyMuted, { marginTop: 4 }]}>{r.text}</Text>
                </View>
              ))}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Reply to Customer</Text>
                <TextInput
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="Write your reply…"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  style={[styles.input, { minHeight: 84, textAlignVertical: "top" }]}
                />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <ActionButton compact label="Send Reply" icon="send-outline" onPress={() => void sendTicketReply("In Progress")} />
                  </View>
                  <ActionButton compact variant="green" label="Resolve" icon="checkmark" onPress={() => void sendTicketReply("Resolved")} />
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}
