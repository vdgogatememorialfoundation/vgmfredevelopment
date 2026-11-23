import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  fetchPickPackQueue,
  fetchPortalDashboard,
  fetchPortalOrders,
  fetchPortalTickets,
  formatINR,
  formatShortDate,
  replyPortalTicket,
  runPickPackAction,
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

const STAFF_ACCENT = "#1F4A32";

export function StaffAppShell({ session, onSignOut }: { session: PortalSession; onSignOut: () => void }) {
  const [tab, setTab] = useState("desk");
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<PortalMetrics | null>(null);
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [orderFilter, setOrderFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pickQueue, setPickQueue] = useState<PortalOrder[]>([]);
  const [packQueue, setPackQueue] = useState<PortalOrder[]>([]);
  const [tickets, setTickets] = useState<PortalTicket[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PortalOrder | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<PortalTicket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [remindingId, setRemindingId] = useState("");
  const [toast, setToast] = useState("");

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [dash, ord, pp, tix] = await Promise.all([
        fetchPortalDashboard(),
        fetchPortalOrders(orderFilter, search),
        fetchPickPackQueue(),
        fetchPortalTickets(),
      ]);
      setMetrics(dash.metrics);
      setOrders(ord.orders);
      setPickQueue([...pp.pickQueue, ...pp.unassigned]);
      setPackQueue(pp.packQueue);
      setTickets(tix.tickets);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [orderFilter, search]);

  useEffect(() => {
    void loadAll();
  }, []);

  const remindOrder = async (order: PortalOrder) => {
    setRemindingId(order.id);
    try {
      const res = await sendBalanceReminder({ orderId: order.id, channels: ["whatsapp", "email"] });
      setToast(
        res.alreadyPaid
          ? `#${order.id} already paid — updated!`
          : `Balance reminder sent for #${order.id} (WA: ${res.whatsapp}, Email: ${res.email})`
      );
      await loadAll();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setRemindingId("");
    }
  };

  const quickPackComplete = async (order: PortalOrder, mode: "pick" | "pack") => {
    try {
      await runPickPackAction({ sub: mode === "pick" ? "complete-pick" : "complete-pack", orderId: order.id });
      setToast(mode === "pick" ? `Order #${order.id} picked!` : `Order #${order.id} marked Packed!`);
      await loadAll();
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  const submitReply = async (status?: string) => {
    if (!selectedTicket || (!replyText.trim() && !status)) return;
    try {
      const res = await replyPortalTicket({ ticketId: selectedTicket.id, text: replyText.trim() || undefined, status });
      setReplyText("");
      setSelectedTicket(res.ticket);
      setTickets((prev) => prev.map((t) => (t.id === res.ticket.id ? res.ticket : t)));
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.white }} edges={["top"]}>
      <PortalTopBar
        title="VGMF Staff"
        subtitle={`${session.name} · Staff Workspace`}
        accent={STAFF_ACCENT}
        refreshing={refreshing}
        onRefresh={() => void loadAll()}
      />

      {toast ? (
        <Pressable
          onPress={() => setToast("")}
          style={{ backgroundColor: P.greenSoft, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#A7F3D0", flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Ionicons name="checkmark-circle" size={16} color={P.green} />
          <Text style={{ flex: 1, fontSize: 12.5, fontWeight: "600", color: P.green }}>{toast}</Text>
          <Ionicons name="close" size={15} color={P.green} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1, backgroundColor: P.bg }}>
        {tab === "desk" ? (
          <ScrollView
            contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 28 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadAll()} tintColor={STAFF_ACCENT} />}
          >
            <View style={styles.card}>
              <Text style={styles.topSub}>STAFF PORTAL · PRODUCTION</Text>
              <Text style={[styles.authTitle, { textAlign: "left", marginTop: 2 }]}>Namaste, {session.firstName || session.name}</Text>
              <Text style={styles.bodyMuted}>Manage daily orders, packed balance reminders, warehouse picking/packing, and customer support.</Text>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <KpiCard
                icon="cube-outline"
                label="Today Orders"
                value={metrics?.todayOrders ?? 0}
                hint={formatINR(metrics?.todayRevenue)}
                accent={STAFF_ACCENT}
                bg={P.greenSoft}
                onPress={() => setTab("orders")}
              />
              <KpiCard
                icon="archive-outline"
                label="Packed · Due"
                value={metrics?.packedUnpaidCount ?? 0}
                hint={formatINR(metrics?.packedUnpaidAmount)}
                accent={P.amber}
                bg={P.amberSoft}
                onPress={() => { setOrderFilter("packed_unpaid"); setTab("orders"); }}
              />
              <KpiCard
                icon="barcode-outline"
                label="Pick & Pack"
                value={pickQueue.length + packQueue.length}
                hint={`${pickQueue.length} pick · ${packQueue.length} pack`}
                accent={P.green}
                bg={P.greenSoft}
                onPress={() => setTab("pickpack")}
              />
              <KpiCard
                icon="chatbubbles-outline"
                label="Open Tickets"
                value={metrics?.openTickets ?? 0}
                hint="Customer helpdesk"
                accent={P.blue}
                bg={P.blueSoft}
                onPress={() => setTab("tickets")}
              />
            </View>

            <SectionHeader title="Recent Orders" actionLabel="View All" onAction={() => setTab("orders")} />
            {orders.slice(0, 6).map((o) => (
              <PortalOrderCard
                key={o.id}
                order={o}
                onPress={() => setSelectedOrder(o)}
                onRemind={o.balanceDue > 0 ? () => void remindOrder(o) : undefined}
                reminding={remindingId === o.id}
              />
            ))}
          </ScrollView>
        ) : null}

        {tab === "orders" ? (
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: P.white, padding: 12, borderBottomWidth: 1, borderBottomColor: P.border, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F3F4F6", borderRadius: 11, paddingHorizontal: 11 }}>
                <Ionicons name="search" size={18} color={P.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search order ID, name, phone…"
                  placeholderTextColor="#9CA3AF"
                  onSubmitEditing={() => void loadAll()}
                  style={{ flex: 1, paddingVertical: 9, fontSize: 14, color: P.ink }}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                {[
                  { id: "all", label: "All" },
                  { id: "packed_unpaid", label: "Packed · Balance Due" },
                  { id: "packed", label: "Packed" },
                  { id: "shipped", label: "Shipped" },
                  { id: "delivered", label: "Delivered" },
                ].map((f) => {
                  const active = orderFilter === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => {
                        setOrderFilter(f.id);
                        void fetchPortalOrders(f.id, search).then((d) => setOrders(d.orders));
                      }}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: active ? STAFF_ACCENT : "#F3F4F6" }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: active ? P.white : "#374151" }}>{f.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 28 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadAll()} tintColor={STAFF_ACCENT} />}
            >
              {orders.length ? (
                orders.map((o) => (
                  <PortalOrderCard
                    key={o.id}
                    order={o}
                    onPress={() => setSelectedOrder(o)}
                    onRemind={o.balanceDue > 0 ? () => void remindOrder(o) : undefined}
                    reminding={remindingId === o.id}
                  />
                ))
              ) : (
                <EmptyBox icon="cube-outline" title="No orders match this filter" />
              )}
            </ScrollView>
          </View>
        ) : null}

        {tab === "pickpack" ? (
          <ScrollView
            contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 28 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadAll()} tintColor={STAFF_ACCENT} />}
          >
            <SectionHeader title={`To Pick (${pickQueue.length})`} />
            {pickQueue.length ? (
              pickQueue.map((o) => (
                <View key={o.id} style={styles.orderCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.orderId}>#{o.id}</Text>
                    <StatusPill label={o.status} tone={statusTone(o.status)} />
                  </View>
                  <Text style={styles.orderCustomer}>{o.deliveryAddress?.fullName || "Customer"}</Text>
                  <Text style={styles.orderItems}>{o.items.map((i) => `${i.title} × ${i.quantity}`).join(", ")}</Text>
                  <View style={{ marginTop: 10 }}>
                    <ActionButton compact variant="green" icon="checkmark-done-outline" label="Mark Picked" onPress={() => void quickPackComplete(o, "pick")} />
                  </View>
                </View>
              ))
            ) : (
              <EmptyBox icon="barcode-outline" title="No pending picks" />
            )}

            <SectionHeader title={`Ready to Pack (${packQueue.length})`} />
            {packQueue.length ? (
              packQueue.map((o) => (
                <View key={o.id} style={styles.orderCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.orderId}>#{o.id}</Text>
                    <StatusPill label="Picked" tone="blue" />
                  </View>
                  <Text style={styles.orderCustomer}>{o.deliveryAddress?.fullName || "Customer"}</Text>
                  <Text style={styles.orderItems}>{o.items.map((i) => `${i.title} × ${i.quantity}`).join(", ")}</Text>
                  <View style={{ marginTop: 10 }}>
                    <ActionButton compact variant="green" icon="cube-outline" label="Mark Packed" onPress={() => void quickPackComplete(o, "pack")} />
                  </View>
                </View>
              ))
            ) : (
              <EmptyBox icon="cube-outline" title="No parcels waiting to pack" />
            )}
          </ScrollView>
        ) : null}

        {tab === "tickets" ? (
          <ScrollView
            contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 28 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadAll()} tintColor={STAFF_ACCENT} />}
          >
            <SectionHeader title="Support Tickets" subtitle={`${tickets.length} live ticket(s)`} />
            {tickets.length ? (
              tickets.map((t) => (
                <Pressable key={t.id} onPress={() => setSelectedTicket(t)} style={styles.orderCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.orderId}>#{t.id}</Text>
                    <StatusPill label={t.status} tone={statusTone(t.status)} />
                  </View>
                  <Text style={styles.orderCustomer} numberOfLines={1}>{t.subject}</Text>
                  <Text style={styles.orderItems} numberOfLines={2}>{t.body}</Text>
                  <Text style={[styles.orderDate, { marginTop: 6 }]}>{t.name} · {formatShortDate(t.createdAt)}</Text>
                </Pressable>
              ))
            ) : (
              <EmptyBox icon="chatbubbles-outline" title="No support tickets" />
            )}
          </ScrollView>
        ) : null}

        {tab === "account" ? (
          <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
            <View style={styles.card}>
              <Text style={styles.modalTitle}>{session.name}</Text>
              <Text style={styles.bodyMuted}>{session.email}</Text>
              <View style={{ alignSelf: "flex-start", marginTop: 6 }}>
                <StatusPill label={session.role.toUpperCase()} tone="green" />
              </View>
            </View>
            <ActionButton variant="outline" icon="log-out-outline" label="Sign Out" onPress={onSignOut} />
          </ScrollView>
        ) : null}
      </View>

      <PortalTabBar
        accent={STAFF_ACCENT}
        active={tab}
        onSelect={setTab}
        tabs={[
          { id: "desk", label: "Desk", icon: "briefcase" },
          { id: "orders", label: "Orders", icon: "cube", badge: metrics?.packedUnpaidCount },
          { id: "pickpack", label: "Pick/Pack", icon: "barcode", badge: pickQueue.length + packQueue.length },
          { id: "tickets", label: "Tickets", icon: "chatbubbles", badge: metrics?.openTickets },
          { id: "account", label: "Account", icon: "person-circle" },
        ]}
      />

      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdated={(next) => {
          setSelectedOrder(next);
          setOrders((prev) => prev.map((o) => (o.id === next.id ? next : o)));
        }}
        accent={STAFF_ACCENT}
      />

      <Modal visible={Boolean(selectedTicket)} animationType="slide" onRequestClose={() => setSelectedTicket(null)}>
        {selectedTicket ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={["top", "bottom"]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setSelectedTicket(null)} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={21} color={P.ink} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Ticket #{selectedTicket.id}</Text>
                <Text style={styles.topSub}>{selectedTicket.name}</Text>
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
                  <Text style={styles.bodyStrong}>{r.from}</Text>
                  <Text style={styles.bodyMuted}>{r.text}</Text>
                </View>
              ))}
              <View style={styles.card}>
                <TextInput
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="Write a reply…"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
                />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <ActionButton compact color={STAFF_ACCENT} label="Send Reply" icon="send-outline" onPress={() => void submitReply("In Progress")} />
                  </View>
                  <ActionButton compact variant="green" label="Resolve" icon="checkmark" onPress={() => void submitReply("Resolved")} />
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}
